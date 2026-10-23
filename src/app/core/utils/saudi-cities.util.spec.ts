import { describe, it, expect } from 'vitest';
import { isSaudiCity, getCanonicalSaudiCity, SAUDI_MAJOR_CITIES } from './saudi-cities.util';

describe('saudi-cities.util', () => {
  describe('isSaudiCity', () => {
    it('should recognize major Saudi cities in standard English casing', () => {
      expect(isSaudiCity('Riyadh')).toBe(true);
      expect(isSaudiCity('Jeddah')).toBe(true);
      expect(isSaudiCity('Dammam')).toBe(true);
      expect(isSaudiCity('Khobar')).toBe(true);
      expect(isSaudiCity('Dhahran')).toBe(true);
      expect(isSaudiCity('Tabuk')).toBe(true);
      expect(isSaudiCity('Taif')).toBe(true);
      expect(isSaudiCity('Buraidah')).toBe(true);
      expect(isSaudiCity('Jubail')).toBe(true);
      expect(isSaudiCity('Abha')).toBe(true);
      expect(isSaudiCity('Khamis Mushait')).toBe(true);
      expect(isSaudiCity('Hail')).toBe(true);
      expect(isSaudiCity('Najran')).toBe(true);
      expect(isSaudiCity('Jazan')).toBe(true);
      expect(isSaudiCity('Yanbu')).toBe(true);
      expect(isSaudiCity('Qatif')).toBe(true);
      expect(isSaudiCity('NEOM')).toBe(true);
    });

    it('should recognize common transliteration variants and prefixes', () => {
      expect(isSaudiCity('riyadh')).toBe(true);
      expect(isSaudiCity('ar riyadh')).toBe(true);
      expect(isSaudiCity('ar-riyadh')).toBe(true);
      expect(isSaudiCity('al khobar')).toBe(true);
      expect(isSaudiCity('al-khobar')).toBe(true);
      expect(isSaudiCity('makkah')).toBe(true);
      expect(isSaudiCity('mecca')).toBe(true);
      expect(isSaudiCity('madinah')).toBe(true);
      expect(isSaudiCity('medina')).toBe(true);
      expect(isSaudiCity('al madinah')).toBe(true);
      expect(isSaudiCity('hofuf')).toBe(true);
      expect(isSaudiCity('al ahsa')).toBe(true);
      expect(isSaudiCity('al-ahsa')).toBe(true);
      expect(isSaudiCity('at taif')).toBe(true);
      expect(isSaudiCity('buraydah')).toBe(true);
      expect(isSaudiCity('jiddah')).toBe(true);
    });

    it('should recognize Arabic script city names', () => {
      expect(isSaudiCity('الرياض')).toBe(true);
      expect(isSaudiCity('جدة')).toBe(true);
      expect(isSaudiCity('مكة المكرمة')).toBe(true);
      expect(isSaudiCity('الدمام')).toBe(true);
    });

    it('should NOT recognize non-Saudi cities (strictly restricted to Saudi Arabia)', () => {
      expect(isSaudiCity('London')).toBe(false);
      expect(isSaudiCity('New York')).toBe(false);
      expect(isSaudiCity('Dubai')).toBe(false);
      expect(isSaudiCity('Abu Dhabi')).toBe(false);
      expect(isSaudiCity('Paris')).toBe(false);
      expect(isSaudiCity('Tokyo')).toBe(false);
      expect(isSaudiCity('Chennai')).toBe(false);
      expect(isSaudiCity('Mumbai')).toBe(false);
      expect(isSaudiCity('Cairo')).toBe(false);
    });

    it('should handle null, empty, or whitespace safely', () => {
      expect(isSaudiCity(null)).toBe(false);
      expect(isSaudiCity(undefined)).toBe(false);
      expect(isSaudiCity('')).toBe(false);
      expect(isSaudiCity('   ')).toBe(false);
    });
  });

  describe('getCanonicalSaudiCity', () => {
    it('should return the canonical name for recognized variations', () => {
      expect(getCanonicalSaudiCity('ar-riyadh')).toBe('Riyadh');
      expect(getCanonicalSaudiCity('al khobar')).toBe('Khobar');
      expect(getCanonicalSaudiCity('makkah')).toBe('Mecca');
      expect(getCanonicalSaudiCity('madinah')).toBe('Medina');
      expect(getCanonicalSaudiCity('al-ahsa')).toBe('Al-Ahsa');
      expect(getCanonicalSaudiCity('hofuf')).toBe('Hofuf');
    });

    it('should return null for non-Saudi cities', () => {
      expect(getCanonicalSaudiCity('San Francisco')).toBeNull();
      expect(getCanonicalSaudiCity('Berlin')).toBeNull();
    });
  });

  describe('SAUDI_MAJOR_CITIES', () => {
    it('should include prominent economic and administrative hubs', () => {
      expect(SAUDI_MAJOR_CITIES).toContain('Riyadh');
      expect(SAUDI_MAJOR_CITIES).toContain('Jeddah');
      expect(SAUDI_MAJOR_CITIES).toContain('Dammam');
      expect(SAUDI_MAJOR_CITIES).toContain('Khobar');
      expect(SAUDI_MAJOR_CITIES).toContain('Jubail');
      expect(SAUDI_MAJOR_CITIES).toContain('NEOM');
    });
  });
});
