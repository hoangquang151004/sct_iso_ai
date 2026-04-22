# Chay backend (PowerShell)

.\.venv\Scripts\activate
cd backend
uvicorn main:app --reload

# Chay frontend (PowerShell)

cd frontend
npm run dev

# Khoi tao database moi tu migration baseline

cd backend
alembic upgrade head

# Seed du lieu bootstrap (organization + role + admin)

python script/create_user.py

# Tao migration moi cho cac lan thay doi model tiep theo

cd backend
alembic revision --autogenerate -m "<message>"
alembic upgrade head

# Kiem tra trang thai migration hien tai

cd backend
alembic current

# Tai khoan dang nhap mac dinh (dev)
username: admin
password: admin12345