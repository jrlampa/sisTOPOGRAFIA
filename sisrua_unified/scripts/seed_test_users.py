import os
import psycopg2
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

db_url = os.getenv("DATABASE_URL")

def seed_users():
    if not db_url:
        print("Erro: DATABASE_URL não encontrada no .env")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        print("Conectado ao banco de dados. Criando usuários de teste...")

        # SQL para criação de usuários (compatível com Supabase Auth)
        # Nota: Usamos senhas conhecidas para o E2E
        sql = """
        -- 1. Habilitar pgcrypto
        CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

        -- 2. Inserir usuários no esquema auth (Supabase Auth)
        -- Senha: SenhaTeste123!
        -- Usamos um loop para evitar erros de duplicidade se rodar 2x
        
        DO $$
        DECLARE
            user_im3_id UUID := gen_random_uuid();
            user_gmail_id UUID := gen_random_uuid();
        BEGIN
            -- Usuário IM3
            IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'teste@im3brasil.com.br') THEN
                INSERT INTO auth.users (
                    instance_id, id, aud, role, email, encrypted_password, 
                    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000', user_im3_id, 'authenticated', 'authenticated', 
                    'teste@im3brasil.com.br', crypt('SenhaTeste123!', gen_salt('bf')), 
                    NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Usuário IM3 Teste"}', 
                    NOW(), NOW()
                );
                
                -- Vincular a Role (Admin para o usuário corporativo)
                INSERT INTO public.user_roles (user_id, role, tenant_id)
                VALUES (user_im3_id::text, 'admin'::user_role, '00000000-0000-0000-0000-000000000001'::uuid);
            END IF;

            -- Usuário Gmail
            IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'teste@gmail.com') THEN
                INSERT INTO auth.users (
                    instance_id, id, aud, role, email, encrypted_password, 
                    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000', user_gmail_id, 'authenticated', 'authenticated', 
                    'teste@gmail.com', crypt('SenhaTeste123!', gen_salt('bf')), 
                    NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Usuário Gmail Teste"}', 
                    NOW(), NOW()
                );
            END IF;
        END $$;
        """

        cur.execute(sql)
        conn.commit()
        print("✅ Usuários de teste criados/verificados com sucesso!")

    except Exception as e:
        print(f"❌ Erro ao criar usuários: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    seed_users()
