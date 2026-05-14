-- Migration: Create user_tiers table for Stripe subscription tracking
-- Description: Store Stripe subscription IDs and tier mapping for users
-- Date: 2026-05-13

BEGIN;

-- Create table to track user subscription status
CREATE TABLE IF NOT EXISTS user_tiers (
    user_id UUID PRIMARY KEY,
    tier TEXT NOT NULL DEFAULT 'community' CHECK (tier IN ('community', 'professional', 'enterprise')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_tiers_user_id FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier ON user_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_user_tiers_stripe_customer_id ON user_tiers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_status ON user_tiers(status);

-- RLS Policy: Users can only read/update their own tier
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tiers_select_own ON user_tiers;
CREATE POLICY user_tiers_select_own ON user_tiers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_tiers_update_own ON user_tiers;
CREATE POLICY user_tiers_update_own ON user_tiers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can manage all
DROP POLICY IF EXISTS user_tiers_service_all ON user_tiers;
CREATE POLICY user_tiers_service_all ON user_tiers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS user_tiers_updated_at_trigger ON user_tiers;
CREATE TRIGGER user_tiers_updated_at_trigger
  BEFORE UPDATE ON user_tiers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Função para criação automática de tier para novos usuários
DROP FUNCTION IF EXISTS create_user_tier_on_signup();
CREATE OR REPLACE FUNCTION create_user_tier_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_tiers (user_id, tier, status)
  VALUES (NEW.id, 'community', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar função ao criar novo user
DROP TRIGGER IF EXISTS create_user_tier_on_auth_user_create ON auth.users;
CREATE TRIGGER create_user_tier_on_auth_user_create
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_tier_on_signup();

-- Grant permissões
GRANT SELECT ON user_tiers TO authenticated, anon;
GRANT UPDATE ON user_tiers TO authenticated;
GRANT ALL ON user_tiers TO service_role;

COMMIT;
