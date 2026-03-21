// ============================================================
// src/hooks/useWebAuthn.js
// Browser WebAuthn (FIDO2) hook
// ============================================================
import { useState, useCallback } from 'react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { authAPI } from '../api';

export function useWebAuthn() {
  const [isSupported] = useState(browserSupportsWebAuthn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Register a new WebAuthn credential (fingerprint enrollment)
   */
  const registerCredential = useCallback(async (voterId) => {
    if (!isSupported) {
      throw new Error('WebAuthn is not supported on this device/browser');
    }
    setIsLoading(true);
    setError(null);
    try {
      // Get challenge from server
      const { data: options } = await authAPI.getWebAuthnEnrollOptions(voterId);

      // Trigger browser biometric prompt
      const registrationResponse = await startRegistration(options);

      // Send response back to server for verification
      const { data: result } = await authAPI.verifyWebAuthnEnroll(voterId, registrationResponse);
      return result;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Biometric authentication was cancelled or timed out.'
        : err.response?.data?.error || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * Authenticate with existing WebAuthn credential
   * Returns the raw authentication response for server verification
   */
  const authenticate = useCallback(async (webauthnOptions) => {
    if (!isSupported) {
      throw new Error('WebAuthn is not supported on this device/browser');
    }
    setIsLoading(true);
    setError(null);
    try {
      const authResponse = await startAuthentication(webauthnOptions);
      return authResponse;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Fingerprint scan was cancelled or timed out. Please try again.'
        : err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isLoading, error, registerCredential, authenticate };
}
