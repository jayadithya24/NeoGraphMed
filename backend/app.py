from flask import Flask, request, jsonify
from flask_cors import CORS
from neo4j import GraphDatabase
import csv
import io

def run_query(query, params=None):
    with driver.session() as session:
        result = session.run(query, params or {})
        return [r.data() for r in result]


def resolve_disease_name(session, disease_name):
    raw_name = str(disease_name or "").strip()
    if not raw_name:
        return ""

    record = session.run(
        """
        MATCH (d:Disease)
        WHERE toLower(trim(d.name)) = toLower(trim($name))
        RETURN d.name AS name
        LIMIT 1
        """,
        name=raw_name,
    ).single()

    return (record["name"].strip() if record and record.get("name") else raw_name)

app = Flask(__name__)
CORS(app)

driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "neo4j123")   # ← change password if needed
)



# --------------------
# Health Check
# --------------------
@app.route("/")
def home():
    return jsonify({"status": "NeoGraphMed Backend is running"})


@app.route("/test")
def test_neo4j():
    query = "MATCH (n) RETURN count(n) AS total_nodes"
    result = run_query(query)
    return jsonify(result)


# --------------------
# Add Patient (WITH NAME ✅)
# --------------------
@app.route("/add_patient", methods=["POST"])
def add_patient():
    try:
        data = request.json or {}
        print("RECEIVED DATA:", data)

        pid = (data.get("pid") or "").strip()
        name = data.get("name")
        age = data.get("age")
        gender = data.get("gender")
        notes = (data.get("notes") or "").strip()

        if not pid or not name:
            return jsonify({"error": "Patient ID and name are required"}), 400

        raw_diseases = data.get("diseases", [])
        if isinstance(raw_diseases, str):
            raw_diseases = raw_diseases.split(",")
        elif not isinstance(raw_diseases, list):
            raw_diseases = []

        diseases = []
        seen = set()
        for item in raw_diseases:
            disease = str(item or "").strip()
            key = disease.lower()
            if disease and key not in seen:
                seen.add(key)
                diseases.append(disease)
        
        with driver.session() as session:
            existing = session.run(
                """
                MATCH (p:Patient {id: toUpper(trim($pid))})
                RETURN count(p) AS total
                """,
                pid=pid,
            ).single()

            if existing and existing["total"] > 0:
                return jsonify({"error": "Patient ID already exists"}), 409

            query = """
            CREATE (p:Patient {id: toUpper(trim($pid))})
            SET p.name = $name,
                p.age = $age,
                p.gender = $gender,
                p.notes = $notes
            """
            session.run(
                query,
                pid=pid,
                name=name,
                age=age,
                gender=gender,
                notes=notes
            )

            # If diseases were not explicitly provided, try inferring from notes
            # by matching known disease names already present in the graph.
            if not diseases and notes:
                inferred = session.run(
                    """
                    MATCH (d:Disease)
                    WHERE toLower($notes) CONTAINS toLower(d.name)
                    RETURN collect(DISTINCT d.name) AS diseases
                    """,
                    notes=notes
                ).single()

                for item in (inferred["diseases"] if inferred else []):
                    disease = str(item or "").strip()
                    key = disease.lower()
                    if disease and key not in seen:
                        seen.add(key)
                        diseases.append(disease)

            for disease in diseases:
                canonical_disease = resolve_disease_name(session, disease)
                if not canonical_disease:
                    continue

                session.run(
                    """
                    MATCH (p:Patient {id: toUpper(trim($pid))})
                    MERGE (d:Disease {name:$disease})
                    MERGE (p)-[:HAS_DISEASE]->(d)
                    """,
                    pid=pid,
                    disease=canonical_disease
                )

        return jsonify({
            "status": "Patient added successfully",
            "linked_diseases": diseases
        }), 200

    except Exception as e:
        print("❌ ERROR in /add_patient:", e)
        return jsonify({"error": "Failed to add patient"}), 500



@app.route("/import_csv", methods=["POST"])
def import_csv():
    try:
        file = request.files["file"]

        rows = csv.DictReader(
            file.stream.read().decode("utf-8").splitlines()
        )

        with driver.session() as session:
            for row in rows:
                pid = row.get("pid", "").strip().upper()
                name = row.get("name")
                age = row.get("age")
                gender = row.get("gender")
                disease = row.get("disease")

                # 1️⃣ Create / update Patient
                session.run(
                    """
                    MERGE (p:Patient {id:$pid})
                    SET p.name=$name,
                        p.age=$age,
                        p.gender=$gender
                    """,
                    pid=pid,
                    name=name,
                    age=age,
                    gender=gender
                )

                # 2️⃣ Create Disease + Relationship
                if disease:
                    canonical_disease = resolve_disease_name(session, disease)

                    session.run(
                        """
                        MATCH (p:Patient {id: toUpper(trim($pid))})
                        MERGE (d:Disease {name:$disease})
                        MERGE (p)-[:HAS_DISEASE]->(d)
                        """,
                        pid=pid,
                        disease=canonical_disease
                    )

                print(f"✅ Imported {pid} → {disease}")

        return jsonify({"status": "CSV imported with relationships"}), 200

    except Exception as e:
        print("❌ ERROR in /import_csv:", e)
        return jsonify({"error": "Failed to import CSV"}), 500




# --------------------
# Link Patient → Disease
# --------------------
@app.route("/link_patient_disease", methods=["POST"])
def link_patient_disease():
    data = request.json

    pid = (data.get("pid") or "").strip().upper()
    disease_raw = (data.get("disease") or "").strip()
    if not pid or not disease_raw:
        return {"error": "Patient ID and disease are required"}, 400

    with driver.session() as session:
        disease = resolve_disease_name(session, disease_raw)

        query = """
        MATCH (p:Patient {id:$pid})
        MERGE (d:Disease {name:$disease})
        MERGE (p)-[:HAS_DISEASE]->(d)
        """

        session.run(
            query,
            pid=pid,
            disease=disease,
        )

    return {"status": "Disease linked successfully"}

@app.route("/patient_insights/<pid>", methods=["GET"])
def patient_insights(pid):

    query = """
    MATCH (p:Patient {id: toUpper(trim($pid))})
    OPTIONAL MATCH (p)-[:HAS_DISEASE]->(d:Disease)
    WITH p, [item IN collect(DISTINCT d) WHERE item IS NOT NULL] AS patient_diseases
    OPTIONAL MATCH (canonical_d:Disease)
    WHERE any(pd IN patient_diseases WHERE toLower(trim(pd.name)) = toLower(trim(canonical_d.name)))
    OPTIONAL MATCH (drug:Drug)-[:TREATS]->(canonical_d)
    OPTIONAL MATCH (drug)-[:TARGETS]->(target_g:Gene)
    OPTIONAL MATCH (assoc_g:Gene)-[:ASSOCIATED_WITH]->(canonical_d)
    RETURN
        p.name AS patient_name,
        p.id AS patient_id,
        [name IN [pd IN patient_diseases | pd.name] WHERE name IS NOT NULL] AS diseases,
        collect(DISTINCT drug.name) AS drugs,
        collect(DISTINCT target_g.name) AS target_genes,
        collect(DISTINCT assoc_g.name) AS associated_genes
    """
    with driver.session() as session:
        record = session.run(query, pid=pid.strip()).single()

    if not record:
        return jsonify({"error": "Patient not found"}), 404

    target_genes = [g for g in (record["target_genes"] or []) if g]
    associated_genes = [g for g in (record["associated_genes"] or []) if g]
    genes = sorted(set(target_genes + associated_genes))

    return jsonify({
        "patient_id": record["patient_id"],
        "patient_name": record["patient_name"],
        "diseases": record["diseases"],
        "drugs": record["drugs"],
        "genes": genes
    })

# --------------------
# Graph API (FINAL & CORRECT)
# --------------------
@app.route("/graph", methods=["GET"])
def get_graph():
    try:
        with driver.session() as session:

            # 1️⃣ Fetch nodes
            nodes_query = """
            MATCH (n)
            RETURN DISTINCT n
            """
            nodes_result = session.run(nodes_query)

            nodes = []
            node_seen = set()

            for record in nodes_result:
                n = record["n"]
                label = list(n.labels)[0]

                if label == "Patient":
                    patient_id = str(n.get("id") or "").strip().upper()
                    node_id = f"Patient:{patient_id}"
                    node_name = node_id
                elif label == "Disease":
                    disease_name = str(n.get("name") or "").strip()
                    if not disease_name:
                        continue

                    # Collapse Disease:Fever and Disease:fever into one visual node.
                    node_id = f"Disease:{disease_name.lower()}"
                    node_name = f"Disease:{disease_name}"
                else:
                    raw_name = str(n.get("name") or "").strip()
                    if not raw_name:
                        continue

                    node_id = f"{label}:{raw_name}"
                    node_name = node_id

        


                if not node_id or node_id in node_seen:
                    continue

                node_seen.add(node_id)
                nodes.append({
                    "id": node_id,
                    "label": list(n.labels)[0],
                    "name": node_name
                })

            # 2️⃣ Fetch relationships
            rels_query = """
            MATCH (a)-[r]->(b)
            RETURN DISTINCT a, r, b
            """
            rels_result = session.run(rels_query)

            links = []
            link_seen = set()

            for record in rels_result:
                a = record["a"]
                b = record["b"]
                r = record["r"]

                def node_key(n):
                    label = list(n.labels)[0]
                    if label == "Patient":
                        return f"Patient:{n.get('id').strip().upper()}"
                    elif label == "Disease":
                        disease_name = str(n.get("name") or "").strip()
                        if not disease_name:
                            return None
                        return f"Disease:{disease_name.lower()}"
                    else:
                        return f"{label}:{n.get('name')}"


                source = node_key(a)
                target = node_key(b)


                if not source or not target:
                    continue

                key = (source, target, r.type)
                if key in link_seen:
                    continue

                link_seen.add(key)
                links.append({
                    "source": source,
                    "target": target,
                    "type": r.type
                })

            return jsonify({
                "nodes": nodes,
                "links": links
            }), 200

    except Exception as e:
        print("GRAPH ERROR:", e)
        return jsonify({"error": "Failed to load graph"}), 500



# --------------------
# Patient Diseases
# --------------------
@app.route("/patient_diseases/<pid>")
def get_patient_diseases(pid):
    query = """
    MATCH (p:Patient {id: $pid})-[:HAS_DISEASE]->(d:Disease)
    RETURN d.name AS disease
    """
    result = run_query(query, {"pid": pid})
    return jsonify(result)

@app.route("/similar_patients/<pid>", methods=["GET"])
def get_similar_patients(pid):
    print("🔍 Similar patients API called for:", pid)

    query = """
    MATCH (p:Patient {id: toUpper(trim($pid))})
          -[:HAS_DISEASE]->(d)
          <-[:HAS_DISEASE]-(other:Patient)
    WHERE other.id <> p.id
    RETURN DISTINCT other.id AS similar
    """

    with driver.session() as session:
        result = session.run(query, pid=pid.strip())
        similar = [r["similar"] for r in result]

    print("✅ Similar patients found:", similar)

    return jsonify({
        "patient": pid,
        "similar_patients": similar
    })



# --------------------
# Run Server
# --------------------
if __name__ == "__main__":
    app.run(debug=True)


@app.route("/node_info", methods=["GET"])
def node_info():
    node_id = request.args.get("id")
    label = request.args.get("label")

    # DRUG INFO
    if label == "Drug":
        query = """
        MATCH (d:Drug {name:$name})
        OPTIONAL MATCH (d)-[:TREATS]->(dis:Disease)
        OPTIONAL MATCH (d)-[:TARGETS]->(g:Gene)
        RETURN
          collect(DISTINCT dis.name) AS diseases,
          collect(DISTINCT g.name) AS genes
        """
        result = run_query(query, {"name": node_id})
        return jsonify(result[0])

    # PATIENT INFO
    if label == "Patient":
        query = """
        MATCH (p:Patient {id: $pid})

        OPTIONAL MATCH (p)-[:HAS_DISEASE]->(d:Disease)
        OPTIONAL MATCH (drug:Drug)-[:TREATS]->(d)
        OPTIONAL MATCH (d)-[:HAS_SYMPTOM]->(s:Symptom)
        RETURN
          p.age AS age,
          p.gender AS gender,
          p.notes AS notes,
          collect(DISTINCT d.name) AS diseases,
          collect(DISTINCT drug.name) AS drugs,
          collect(DISTINCT s.name) AS symptoms
        """
        result = run_query(query, {"pid": node_id})
        return jsonify(result[0])

    return jsonify({})



