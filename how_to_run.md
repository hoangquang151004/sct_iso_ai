# lệnh chạy backend

.\.venv\Scripts\activate
cd backend
uvicorn main:app --reload

# lệnh chạy frontend

cd frontend
npm run dev

# lệnh init dự án

alembic init alembic

# lệnh migrate database

$env:DATABASE_URL="postgresql+psycopg2://<user>:<password>@<host>:5432/<db_name>"
alembic revision --autogenerate -m "init"
alembic upgrade head

# lệnh migrate các lần sau

$env:DATABASE_URL="postgresql+psycopg2://<user>:<password>@<host>:5432/<db_name>"
alembic revision --autogenerate -m "<message>"
alembic upgrade head

# lệnh kiểm tra migration hiện tại

alembic current
