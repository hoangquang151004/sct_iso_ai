import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="sct_iso",
    user="postgres",
    password="123"
)

cursor = conn.cursor()
cursor.execute("SELECT version();")
print(cursor.fetchone())

cursor.close()
conn.close()