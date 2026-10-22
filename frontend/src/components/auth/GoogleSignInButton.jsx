import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../../api/client';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let clientIdRequest = null;
function loadClientId() {
  clientIdRequest ||= authFetch('/auth/google-config')
    .then(res => (res.ok ? res.json() : {}))
    .then(data => data.clientId || null)
    .catch(() => {
      clientIdRequest = null;
      return null;
    });
  return clientIdRequest;
}

let scriptRequest = null;
function loadGoogleScript() {
  scriptRequest ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      scriptRequest = null;
      script.remove();
      reject(new Error('Could not load Google sign-in.'));
    };
    document.head.appendChild(script);
  });
  return scriptRequest;
}

/**
 * Google Identity Services button. Renders nothing until the backend reports a client ID,
 * so the email form stands alone when Google sign-in is not configured.
 */
export function GoogleSignInButton({ onCredential, text = 'signin_with' }) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    let active = true;
    loadClientId().then(id => active && setClientId(id));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(google => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: response => callbackRef.current?.(response.credential)
        });
        google.accounts.id.renderButton(container, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text,
          width: Math.min(400, container.offsetWidth || 320)
        });
      })
      .catch(err => console.warn(err.message));
    return () => { cancelled = true; };
  }, [clientId, text]);

  if (!clientId) return null;
  return (
    <>
      <div ref={containerRef} className="google-signin" />
      <div className="divider">or use email</div>
    </>
  );
}

export default GoogleSignInButton;
