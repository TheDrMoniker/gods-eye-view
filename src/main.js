import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { t } from './i18n/index.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then(async () => {
  // Disabled in every production bundle. Never preload third-party geometry.
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get('reconResearch') !== '1') return;
  const { createApplicationResearchPreview } = await import('./reconstruction/applicationResearch.js');
  const research = createApplicationResearchPreview({ application });
  const stop = application.subscribe((state) => {
    if (state.status === 'destroying' || state.status === 'destroyed') {
      research.dispose();
      stop();
    }
  });
  window.__gevReconstructionResearch = research;
}).catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  loaderStatus.textContent = t('Error: {message}', {
    message: describeError(error),
  });
  loaderStatus.style.color = '#ff4444';
});

export { application };
