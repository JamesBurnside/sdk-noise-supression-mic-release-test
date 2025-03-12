import { AudioEffectsStartConfig, AudioEffectsStopConfig, Call, CallClient, Features } from "@azure/communication-calling";
import { DeepNoiseSuppressionEffect } from "@azure/communication-calling-effects";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

const groupId = '9d5ec556-3677-4c5b-a648-cfeb05f90659';

// Mobile its a pain to get the token, so we have a default one that is auto applied
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

  // REQUEST PERMISSIONS
  await navigator.permissions.query({ name: 'camera' as PermissionName });
  await navigator.permissions.query({ name: 'microphone' as PermissionName})
  
  // LOAD SDK
  const sdkStatusSpan = document.getElementById('sdkStatus');
  sdkStatusSpan.innerText = 'SDK Loading';
  const callClient = new CallClient();
  const tokenCredential = new AzureCommunicationTokenCredential(token);
  const callAgent = await callClient.createCallAgent(tokenCredential, { displayName: `ACS User ${Math.floor(Math.random() * 100)}` });
  const deviceManager = await callClient.getDeviceManager()
  sdkStatusSpan.innerText = 'SDK Loaded';
  const displayNameSpan = document.getElementById('displayName');
  displayNameSpan.innerText = callAgent.displayName;

  // JOIN CALL
  const call = callAgent.join({ groupId }, { audioOptions: { muted: true } });
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
      call.isMuted ? await call.unmute() : await call.mute();
    } finally {
      muteButton.disabled = false;
    }
  });

  // SETUP DEEP NOISE SUPRESSION BUTTON
  const deepNoiseSupressionButton = document.getElementById('deepNoiseSupressionButton') as HTMLButtonElement;
  deepNoiseSupressionButton.addEventListener('click', async () => {
    deepNoiseSupressionButton.disabled = true;
    try {
      if (noiseSuppressionEnabled) {
        await stopNoiseSuppressionEffect(call);
      } else {
        await startNoiseSuppressionEffect(call);
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
      await call.hangUp();
    } finally {
      endCallButton.disabled = false;
    }
  });
}

const startNoiseSuppressionEffect = async (call: Call): Promise<void> => {
  console.log('Starting noise suppression effect');
  const audioEffects: AudioEffectsStartConfig = {
    noiseSuppression: new DeepNoiseSuppressionEffect()
  }
  const stream = call?.localAudioStreams.find((stream) => stream.mediaStreamType === 'Audio');
  if (stream && audioEffects && audioEffects.noiseSuppression) {
    const audioEffectsFeature = stream.feature(Features.AudioEffects);
    const isNoiseSuppressionSupported = await audioEffectsFeature.isSupported(audioEffects.noiseSuppression);
    if (isNoiseSuppressionSupported) {
      await audioEffectsFeature.startEffects(audioEffects);
    } else {
      console.warn('Deep Noise Suppression is not supported on this platform.');
    }
  }
};

const stopNoiseSuppressionEffect = async (call: Call): Promise<void> => {
  console.log('Stopping noise suppression effect');
  const stream = call?.localAudioStreams.find((stream) => stream.mediaStreamType === 'Audio');
  if (stream) {
    const audioEffects: AudioEffectsStopConfig = {
      noiseSuppression: true
    };
    const audioEffectsFeature = stream.feature(Features.AudioEffects);
    await audioEffectsFeature.stopEffects(audioEffects);
  }
};

main();