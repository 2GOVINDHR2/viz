import 'katex/dist/katex.min.css';
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

// Study Mode is a separate entry (#study), loaded only when asked for.
const StudyApp = lazy(() => import('./study/ui/StudyApp').then((m) => ({ default: m.StudyApp })));
const isStudy = (): boolean => window.location.hash.startsWith('#study');

function Root() {
  const [study, setStudy] = useState(isStudy());
  useEffect(() => {
    const f = (): void => setStudy(isStudy());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return study ? (
    <Suspense fallback={<p>Loading Study Mode…</p>}>
      <StudyApp />
    </Suspense>
  ) : (
    <App />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
