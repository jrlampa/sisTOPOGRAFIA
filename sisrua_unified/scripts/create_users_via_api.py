import os
import requests
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def create_user(email, password):
    if not supabase_url or not service_role_key:
        print("Erro: chaves do Supabase não encontradas.")
        return

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }

    url = f"{supabase_url}/auth/v1/admin/users"
    
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True
    }

    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 201:
        print(f"✅ Usuário {email} criado com sucesso via API.")
        return response.json()
    else:
        print(f"❌ Erro ao criar {email}: {response.status_code} - {response.text}")
        return None

if __name__ == "__main__":
    create_user("teste@im3brasil.com.br", "SenhaTeste123!")
    create_user("teste@gmail.com", "SenhaTeste123!")
