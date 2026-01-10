import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, withRateLimit } from '../rateLimitService';

describe('RateLimitService', () => {
  beforeEach(() => {
    // Nettoyer le localStorage avant chaque test
    localStorage.clear();
    // Réinitialiser les mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Nettoyer après chaque test
    localStorage.clear();
  });

  describe('checkLimit', () => {
    it('devrait autoriser les requêtes dans la limite', () => {
      expect(RateLimiter.checkLimit('auth')).toBe(true);
      expect(RateLimiter.checkLimit('auth')).toBe(true);
      expect(RateLimiter.checkLimit('auth')).toBe(true);
    });

    it('devrait bloquer après avoir atteint la limite', () => {
      // La config auth permet 5 tokens max
      for (let i = 0; i < 5; i++) {
        expect(RateLimiter.checkLimit('auth')).toBe(true);
      }
      // La 6ème requête devrait être bloquée
      expect(RateLimiter.checkLimit('auth')).toBe(false);
    });

    it('devrait bloquer pour différents utilisateurs indépendamment', () => {
      // User 1
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkLimit('auth', 'user1');
      }
      expect(RateLimiter.checkLimit('auth', 'user1')).toBe(false);

      // User 2 devrait toujours pouvoir accéder
      expect(RateLimiter.checkLimit('auth', 'user2')).toBe(true);
    });

    it('devrait autoriser les requêtes après refill', async () => {
      // Utiliser 5 tokens
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkLimit('auth');
      }
      expect(RateLimiter.checkLimit('auth')).toBe(false);

      // Attendre suffisamment pour un refill (auth: 1 token/60s = 60000ms)
      // En réalité, on mocke le temps pour éviter d'attendre
      vi.useFakeTimers();
      vi.advanceTimersByTime(61000); // 61 secondes

      // Devrait avoir un nouveau token
      expect(RateLimiter.checkLimit('auth')).toBe(true);

      vi.useRealTimers();
    });

    it('devrait fonctionner avec différentes opérations', () => {
      // API permet 100 tokens
      for (let i = 0; i < 100; i++) {
        expect(RateLimiter.checkLimit('api')).toBe(true);
      }
      expect(RateLimiter.checkLimit('api')).toBe(false);

      // Search permet 30 tokens
      for (let i = 0; i < 30; i++) {
        expect(RateLimiter.checkLimit('search')).toBe(true);
      }
      expect(RateLimiter.checkLimit('search')).toBe(false);
    });

    it('devrait fail-open si config manquante', () => {
      // Operation inexistante
      expect(RateLimiter.checkLimit('unknown_operation')).toBe(true);
    });
  });

  describe('getWaitTime', () => {
    it('devrait retourner 0 si des tokens sont disponibles', () => {
      expect(RateLimiter.getWaitTime('auth')).toBe(0);
    });

    it('devrait calculer le temps d\'attente correctement', () => {
      // Utiliser tous les tokens
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkLimit('auth');
      }

      const waitTime = RateLimiter.getWaitTime('auth');
      // Auth: 1 token/60s, donc waitTime devrait être environ 60000ms
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(60000);
    });

    it('devrait retourner 0 pour config manquante', () => {
      expect(RateLimiter.getWaitTime('unknown')).toBe(0);
    });
  });

  describe('reset', () => {
    it('devrait réinitialiser le rate limit pour une opération', () => {
      // Utiliser tous les tokens
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkLimit('auth');
      }
      expect(RateLimiter.checkLimit('auth')).toBe(false);

      // Reset
      RateLimiter.reset('auth');

      // Devrait pouvoir utiliser à nouveau
      expect(RateLimiter.checkLimit('auth')).toBe(true);
    });

    it('devrait réinitialiser pour un utilisateur spécifique', () => {
      // User 1 utilise tous ses tokens
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkLimit('auth', 'user1');
      }
      expect(RateLimiter.checkLimit('auth', 'user1')).toBe(false);

      // Reset user1
      RateLimiter.reset('auth', 'user1');

      // User1 peut à nouveau
      expect(RateLimiter.checkLimit('auth', 'user1')).toBe(true);

      // User2 n'est pas affecté
      expect(RateLimiter.checkLimit('auth', 'user2')).toBe(true);
    });
  });

  describe('enable/disable', () => {
    it('devrait désactiver le rate limiting', () => {
      RateLimiter.disable();

      // Toutes les requêtes devraient passer
      for (let i = 0; i < 100; i++) {
        expect(RateLimiter.checkLimit('auth')).toBe(true);
      }

      // Réactiver
      RateLimiter.enable();
    });

    it('devrait réactiver le rate limiting', () => {
      RateLimiter.disable();
      RateLimiter.enable();

      // Le rate limiting devrait fonctionner normalement
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkLimit('auth');
      }
      expect(RateLimiter.checkLimit('auth')).toBe(false);
    });
  });

  describe('setConfig', () => {
    it('devrait permettre de définir une config personnalisée', () => {
      RateLimiter.setConfig('custom', {
        maxTokens: 3,
        refillRate: 1, // 1 token/sec
        keyPrefix: 'rl_custom'
      });

      // Utiliser les 3 tokens
      for (let i = 0; i < 3; i++) {
        expect(RateLimiter.checkLimit('custom')).toBe(true);
      }
      expect(RateLimiter.checkLimit('custom')).toBe(false);
    });

    it('devrait permettre de modifier une config existante', () => {
      // Modifier la config auth pour être plus restrictive
      RateLimiter.setConfig('auth', {
        maxTokens: 2,
        refillRate: 1 / 60,
        keyPrefix: 'rl_auth'
      });

      expect(RateLimiter.checkLimit('auth')).toBe(true);
      expect(RateLimiter.checkLimit('auth')).toBe(true);
      expect(RateLimiter.checkLimit('auth')).toBe(false);

      // Reset pour les autres tests
      RateLimiter.setConfig('auth', {
        maxTokens: 5,
        refillRate: 1 / 60,
        keyPrefix: 'rl_auth'
      });
    });
  });

  describe('cleanup', () => {
    it('devrait supprimer les anciens buckets', () => {
      // Créer des buckets
      RateLimiter.checkLimit('auth');
      RateLimiter.checkLimit('api');

      // Vérifier qu'ils existent
      const keysBeforeCleanup = Object.keys(localStorage).filter(k => k.startsWith('rl_'));
      expect(keysBeforeCleanup.length).toBeGreaterThan(0);

      // Mock le temps pour simuler 25h plus tard
      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      // Cleanup
      RateLimiter.cleanup();

      // Les anciens buckets devraient être supprimés
      const keysAfterCleanup = Object.keys(localStorage).filter(k => k.startsWith('rl_'));
      expect(keysAfterCleanup.length).toBe(0);

      vi.useRealTimers();
    });

    it('devrait conserver les buckets récents', () => {
      // Créer un bucket récent
      RateLimiter.checkLimit('auth');

      // Cleanup immédiat
      RateLimiter.cleanup();

      // Le bucket devrait être conservé
      const keys = Object.keys(localStorage).filter(k => k.startsWith('rl_'));
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('devrait persister le state dans localStorage', () => {
      RateLimiter.checkLimit('auth');
      RateLimiter.checkLimit('auth');

      // Vérifier que le state est sauvegardé
      const keys = Object.keys(localStorage).filter(k => k.startsWith('rl_auth'));
      expect(keys.length).toBeGreaterThan(0);

      const stored = localStorage.getItem(keys[0]);
      expect(stored).toBeDefined();

      const bucket = JSON.parse(stored!);
      expect(bucket).toHaveProperty('tokens');
      expect(bucket).toHaveProperty('lastRefill');
      expect(bucket.tokens).toBeLessThan(5); // 2 tokens utilisés
    });

    it('devrait restaurer le state depuis localStorage', () => {
      // Utiliser 3 tokens
      RateLimiter.checkLimit('auth', 'testuser');
      RateLimiter.checkLimit('auth', 'testuser');
      RateLimiter.checkLimit('auth', 'testuser');

      // Simuler un rechargement en réutilisant le même userId
      // Le rate limiter devrait se souvenir qu'il ne reste que 2 tokens
      expect(RateLimiter.checkLimit('auth', 'testuser')).toBe(true);
      expect(RateLimiter.checkLimit('auth', 'testuser')).toBe(true);
      expect(RateLimiter.checkLimit('auth', 'testuser')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('devrait gérer les erreurs de localStorage', () => {
      // Mock localStorage pour simuler une erreur
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Ne devrait pas crasher
      expect(() => RateLimiter.checkLimit('auth')).not.toThrow();

      // Restaurer
      localStorage.setItem = originalSetItem;
    });

    it('devrait gérer les données corrompues dans localStorage', () => {
      // Insérer des données invalides
      localStorage.setItem('rl_auth_test', 'invalid json');

      // Ne devrait pas crasher
      expect(() => RateLimiter.checkLimit('auth', 'test')).not.toThrow();
    });
  });
});

describe('withRateLimit decorator', () => {
  it('devrait protéger une fonction avec rate limiting', () => {
    const mockFn = vi.fn(() => 'success');
    const protectedFn = withRateLimit('auth', mockFn);

    // Les 5 premiers appels devraient réussir
    for (let i = 0; i < 5; i++) {
      expect(protectedFn()).toBe('success');
    }

    // Le 6ème devrait lancer une erreur
    expect(() => protectedFn()).toThrow('Rate limit exceeded');
    expect(mockFn).toHaveBeenCalledTimes(5);
  });

  it('devrait passer les arguments à la fonction protégée', () => {
    const mockFn = vi.fn((a: number, b: number) => a + b);
    const protectedFn = withRateLimit('auth', mockFn);

    expect(protectedFn(2, 3)).toBe(5);
    expect(mockFn).toHaveBeenCalledWith(2, 3);
  });
});
