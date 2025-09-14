import { MediaOptions, Preferences, RunConfig, Toggles } from './types';
import { observe, Session } from 'koishi';

export const configPropertyNameMapCN: Record<string, string> = {
  'mediaOptions.overrideResolution': '分辨率',
  'mediaOptions.frameRate': '帧率',
  'mediaOptions.videoCodec': '视频编码器',
  'mediaOptions.videoBitrate': '视频码率',
  'mediaOptions.audioBitrate': '音频码率',
  'mediaOptions.resultsLoopsToRender': '结算循环次数',
  'preferences.backgroundBlur': '背景模糊',
  'preferences.backgroundLuminance': '背景亮度',
  'preferences.chartFlipping': '谱面翻转',
  'preferences.chartOffset': '谱面偏移',
  'preferences.fcApIndicator': 'FC/AP指示器',
  'preferences.hitSoundVolume': '打击效果音量',
  'preferences.lineThickness': '线条粗细',
  'preferences.musicVolume': '音乐音量',
  'preferences.noteSize': '音符大小',
  'preferences.simultaneousNoteHint': '多押提示',
  'toggles.autoplay': '自动游玩'
};

export const configPropertyNameMapEN: Record<string, string> = {
  'mediaOptions.overrideResolution': 'Resolution',
  'mediaOptions.frameRate': 'FrameRate',
  'mediaOptions.videoCodec': 'VideoCodec',
  'mediaOptions.videoBitrate': 'VideoBitrate',
  'mediaOptions.audioBitrate': 'AudioBitrate',
  'mediaOptions.resultsLoopsToRender': 'ResultsLoopsToRender',
  'preferences.backgroundBlur': 'BackgroundBlur',
  'preferences.backgroundLuminance': 'BackgroundLuminance',
  'preferences.chartFlipping': 'ChartFlipping',
  'preferences.chartOffset': 'ChartOffset',
  'preferences.fcApIndicator': 'FC/APIndicator',
  'preferences.hitSoundVolume': 'HitSoundVolume',
  'preferences.lineThickness': 'LineThickness',
  'preferences.musicVolume': 'MusicVolume',
  'preferences.noteSize': 'NoteSize',
  'preferences.simultaneousNoteHint': 'SimultaneousNoteHint',
  'toggles.autoplay': 'Autoplay'
};

export const configLocalizedNameMap: Record<string, string> = Object.fromEntries(
  [configPropertyNameMapCN, configPropertyNameMapEN].flatMap((map) =>
    Object.entries(map).map(([path, name]) => [name.toLowerCase(), path])
  )
);

export const getNestedProperty = (obj: unknown, path: string) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

export const setNestedProperty = (obj: unknown, path: string, value: unknown): void => {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
};

export const getConfigSummary = (config: RunConfig, session: Session, full = true) => {
  return (
    (full
      ? session.text('configSummary.title') +
        `\n\n${session.text('configSummary.user', [config.user])}`
      : '') +
    `\n\n${session.text('configSummary.mediaOptions', [getMediaOptions(config.mediaOptions, session)])}` +
    `\n\n${session.text('configSummary.preferences', [getPreferences(config.preferences, session)])}` +
    `\n\n${session.text('configSummary.toggles', [getToggles(config.toggles, session)])}`
  );
};

export const getPlatform = (prefix: string) => {
  switch (prefix) {
    case 'qq':
      return 'onebot';
    default:
      return prefix;
  }
};

export const toPrefix = (session: Session) => {
  const platform = session.event.platform;
  return platform === 'onebot' ? 'qq' : platform;
};

export const prepareSession = async (session: Session) => {
  const channel = await session.getChannel(session.event.channel.id, ['locales']);
  const sUser = await session.getUser(session.event.user.id, ['locales']);
  session.channel = observe(channel, () => undefined);
  session.user = observe(sUser, () => undefined);
};

export const getMediaOptions = (mediaOptions: MediaOptions, session: Session) => {
  const colon = session.text('configSummary.propertyColon');
  return (
    `\n· ${session.text('config.mediaOptions.overrideResolution')}${colon}${mediaOptions.overrideResolution.join('x')}` +
    `\n· ${session.text('config.mediaOptions.frameRate')}${colon}${mediaOptions.frameRate} fps` +
    `\n· ${session.text('config.mediaOptions.videoCodec')}${colon}${mediaOptions.videoCodec}` +
    `\n· ${session.text('config.mediaOptions.videoBitrate')}${colon}${mediaOptions.videoBitrate} kbps` +
    `\n· ${session.text('config.mediaOptions.audioBitrate')}${colon}${mediaOptions.audioBitrate} kbps` +
    `\n· ${session.text('config.mediaOptions.resultsLoopsToRender')}${colon}${mediaOptions.resultsLoopsToRender}`
  );
};

export const getPreferences = (preferences: Preferences, session: Session) => {
  const colon = session.text('configSummary.propertyColon');
  const chartFlippingText =
    preferences.chartFlipping === 0
      ? session.text('configSummary.chartFlipping.off')
      : preferences.chartFlipping === 1
        ? session.text('configSummary.chartFlipping.horizontal')
        : preferences.chartFlipping === 2
          ? session.text('configSummary.chartFlipping.vertical')
          : preferences.chartFlipping === 3
            ? session.text('configSummary.chartFlipping.both')
            : session.text('configSummary.chartFlipping.unknown');

  const enabledText = session.text('configSummary.enabled');
  const disabledText = session.text('configSummary.disabled');

  return (
    `\n· ${session.text('config.preferences.backgroundBlur')}${colon}${preferences.backgroundBlur}` +
    `\n· ${session.text('config.preferences.backgroundLuminance')}${colon}${preferences.backgroundLuminance}` +
    `\n· ${session.text('config.preferences.chartFlipping')}${colon}${chartFlippingText}` +
    `\n· ${session.text('config.preferences.chartOffset')}${colon}${preferences.chartOffset} ms` +
    `\n· ${session.text('config.preferences.fcApIndicator')}${colon}${preferences.fcApIndicator ? enabledText : disabledText}` +
    `\n· ${session.text('config.preferences.hitSoundVolume')}${colon}${preferences.hitSoundVolume}` +
    `\n· ${session.text('config.preferences.lineThickness')}${colon}${preferences.lineThickness}` +
    `\n· ${session.text('config.preferences.musicVolume')}${colon}${preferences.musicVolume}` +
    `\n· ${session.text('config.preferences.noteSize')}${colon}${preferences.noteSize}` +
    `\n· ${session.text('config.preferences.simultaneousNoteHint')}${colon}${preferences.simultaneousNoteHint ? enabledText : disabledText}`
  );
};

export const getToggles = (toggles: Toggles, session: Session) => {
  const colon = session.text('configSummary.propertyColon');
  const enabledText = session.text('configSummary.enabled');
  const disabledText = session.text('configSummary.disabled');
  return `\n· ${session.text('config.toggles.autoplay')}${colon}${toggles.autoplay ? enabledText : disabledText}`;
};

export const encodeUrlSafe = (str: string): string => {
  return str.replace(/[^A-Za-z0-9-:./]/g, (char) => {
    const code = char.charCodeAt(0);
    return '%' + code.toString(16).toUpperCase().padStart(2, '0');
  });
};

export const toPercent = (value: number) =>
  value.toLocaleString(undefined, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
