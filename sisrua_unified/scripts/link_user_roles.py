import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

def link_roles():
    if not db_url: return
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Vincular IM3 como Admin no Tenant 1
        cur.execute("""
            INSERT INTO public.user_roles (user_id, role, tenant_id)
            VALUES ('aa140310-7081-4edf-8b81-f46f10c33b8a', 'admin'::user_role, '00000000-0000-0000-0000-000000000001'::uuid)
            ON CONFLICT (user_id) DO UPDATE SET role = 'admin'::user_role;
        """)
        
        conn.commit()
        print("✅ Role vinculada para teste@im3brasil.com.br")
    except Exception as e:
        print(f"❌ Erro: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    link_roles()
