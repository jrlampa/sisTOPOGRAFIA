import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

def delete_users():
    if not db_url: return
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("DELETE FROM auth.users WHERE email IN ('teste@im3brasil.com.br', 'teste@gmail.com')")
        conn.commit()
        print("Usuários deletados via SQL.")
    except Exception as e:
        print(f"Erro: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    delete_users()
