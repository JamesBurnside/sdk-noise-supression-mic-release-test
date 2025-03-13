import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { CallComposite, createAzureCommunicationCallAdapter, createStatefulCallClient, onResolveDeepNoiseSuppressionDependency } from "@azure/communication-react";

const groupId = '9d5ec556-3677-4c5b-a648-cfeb05f90659';

// Mobile its a pain to get the userId token, so we have a default one that is auto applied
const defaultMobileUserId = '<REPLACE_ME>';
const defaultMobileToken = '<REPLACE_ME>';

let noiseSuppressionEnabled = false;

async function main() {
  console.log('Starting app');

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  // await for input of #userTokenInput to have value
  const token = (isAndroid || isIos) ? defaultMobileToken : await new Promise<string>((resolve) => {
    const userTokenInput = document.getElementById('userTokenInput') as HTMLInputElement;
    userTokenInput.addEventListener('input', () => {
      userTokenInput.disabled = true;
      resolve(userTokenInput.value);
    });
  });

  // await for input of #userTokenInput to have value
  const userId = (isAndroid || isIos) ? defaultMobileUserId : await new Promise<string>((resolve) => {
    const userIdInput = document.getElementById('userIdInput') as HTMLInputElement;
    userIdInput.addEventListener('input', () => {
      userIdInput.disabled = true;
      resolve(userIdInput.value);
    });
  });

  // REQUEST PERMISSIONS
  await navigator.permissions.query({ name: 'camera' as PermissionName });
  await navigator.permissions.query({ name: 'microphone' as PermissionName})
  
  // LOAD SDK
  const sdkStatusSpan = document.getElementById('sdkStatus');
  sdkStatusSpan.innerText = 'SDK Loading';
  const displayName = `ACS User ${Math.floor(Math.random() * 100)}`
  const displayNameSpan = document.getElementById('displayName');
  displayNameSpan.innerText = displayName;

  const adapter = await createAdapter(userId, token, displayName);
  sdkStatusSpan.innerText = 'SDK Loaded';

  // JOIN CALL
  const call = adapter.joinCall();
  const callStatusSpan = document.getElementById('callStatus');
  call.on('stateChanged', () => {
    callStatusSpan.innerText = call.state;
  });
  const callIdSpan = document.getElementById('callId');
  callIdSpan.innerText = call.id;
  call.on('idChanged', () => {
    callIdSpan.innerText = call.id;
  });

  // SETUP MIC BUTTON
  const muteButton = document.getElementById('micButton') as HTMLButtonElement;
  call.on('isMutedChanged', () => {
    muteButton.innerText = call.isMuted ? 'Unmute' : 'Mute';
  });
  muteButton.addEventListener('click', async () => {
    muteButton.disabled = true;
    try {
      call.isMuted ? await adapter.unmute() : await adapter.mute();
    } finally {
      muteButton.disabled = false;
    }
  });

  // SETUP DEEP NOISE SUPRESSION BUTTON
  const deepNoiseSupressionButton = document.getElementById('deepNoiseSupressionButton') as HTMLButtonElement;
  deepNoiseSupressionButton.addEventListener('click', async () => {
    deepNoiseSupressionButton.disabled = true;
    try {
      if (!noiseSuppressionEnabled) {
        await adapter.startNoiseSuppressionEffect();
      } else {
        await adapter.stopNoiseSuppressionEffect();
      }
      noiseSuppressionEnabled = !noiseSuppressionEnabled;
      deepNoiseSupressionButton.innerText = noiseSuppressionEnabled ? 'Stop Deep Noise Suppression' : 'Start Deep Noise Suppression';
    } finally {
      deepNoiseSupressionButton.disabled = false;
    }
  });

  // SETUP END CALL BUTTON
  const endCallButton = document.getElementById('endCallButton') as HTMLButtonElement;
  endCallButton.addEventListener('click', async () => {
    endCallButton.disabled = true;
    try {
      await adapter.leaveCall();
    } finally {
      endCallButton.disabled = false;
    }
  });

  return adapter;
}

const createAdapter = (
  userId: string,
  token: string,
  displayName: string
) => {
  return createAzureCommunicationCallAdapter({
    userId: { communicationUserId: userId },
    credential: new AzureCommunicationTokenCredential(token),
    displayName,
    locator: { groupId },
    options: {
      deepNoiseSuppressionOptions: {
        deepNoiseSuppressionOnByDefault: false,
        onResolveDependency: onResolveDeepNoiseSuppressionDependency
      }
    }
  });
}

const App = () => {
  const [adapter, setAdapter] = React.useState<any>(null);

  useEffect(() => {
    main().then((adapter) => {
      setAdapter(adapter);
    });
  }, []);

  if (!adapter) {
    return <div>Loading...</div>;
  }

  return (
    <CallComposite adapter={adapter} />
  )
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
