/** Study Mode entry (#study): the researcher screen, or the active participant's current stage. */
import { useEffect } from 'react';
import { activeParticipant, flushStudy, useStudy } from '../store';
import { Intervention } from './Intervention';
import { Researcher } from './Researcher';
import { Consent, DemographicsForm, End, Feedback, Questionnaires, Test } from './Screens';

export function StudyApp() {
  const s = useStudy();
  const p = activeParticipant(s);
  useEffect(() => {
    window.addEventListener('beforeunload', flushStudy);
    return () => window.removeEventListener('beforeunload', flushStudy);
  }, []);
  if (!p) return <Researcher />;
  switch (p.stage) {
    case 'consent':
      return <Consent p={p} />;
    case 'demographics':
      return <DemographicsForm p={p} />;
    case 'pre':
    case 'post':
      return <Test key={p.stage} p={p} phase={p.stage} />;
    case 'intervention':
      return <Intervention p={p} />;
    case 'questionnaires':
      return <Questionnaires p={p} />;
    case 'feedback':
      return <Feedback p={p} />;
    default:
      return <End p={p} />;
  }
}
