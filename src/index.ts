import { Context, h, Schema, Session } from 'koishi';
import { OneBotBot } from 'koishi-plugin-adapter-onebot';
import { Room, Run, RunConfig, RunInput } from './types';
import {
  getConfigSummary,
  configLocalizedNameMap,
  getNestedProperty,
  setNestedProperty,
  toPercent
} from './utils';
import { Client } from './client';
import { io } from 'socket.io-client';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

declare module 'koishi' {
  interface Tables {
    pzpAgentConfig: RunConfig & { id: number };
    pzpAgentRoom: Room;
  }
}

export const name = 'phizone-player-agent';
export const inject = ['database'];

export interface Config {
  apiBase: string;
  apiSecret: string;
  apiWebsocket: string;
  ncWebsocket: string;
  ncSecret: string;
}

export const Config: Schema<Config> = Schema.object({
  apiBase: Schema.string().required().description('API 地址').default('https://agent.phizone.cn'),
  apiSecret: Schema.string().required().description('API 密钥').role('secret'),
  apiWebsocket: Schema.string()
    .required()
    .description('API WebSocket 地址')
    .default('wss://agent.phizone.cn'),
  ncWebsocket: Schema.string()
    .required()
    .description('NapCat WebSocket 地址')
    .default('ws://localhost:3000'),
  ncSecret: Schema.string().required().description('NapCat WebSocket 密钥').role('secret')
});

const getConfig = async (user: string, ctx: Context) => {
  const results = await ctx.database.get('pzpAgentConfig', { user });

  let config: RunConfig & { id: number };
  if (!results || results.length === 0) {
    config = await initConfig(user, ctx);
  } else {
    config = results[0];
  }

  return config;
};

const initConfig = async (user: string, ctx: Context) =>
  await ctx.database.create('pzpAgentConfig', {
    mediaOptions: {
      frameRate: 60,
      overrideResolution: [1620, 1080],
      resultsLoopsToRender: 1,
      videoCodec: 'libx264',
      videoBitrate: 6000,
      audioBitrate: 320
    },
    preferences: {
      backgroundBlur: 1,
      backgroundLuminance: 0.5,
      chartFlipping: 0,
      chartOffset: 0,
      fcApIndicator: true,
      hitSoundVolume: 0.75,
      lineThickness: 1,
      musicVolume: 1,
      noteSize: 1,
      simultaneousNoteHint: true
    },
    toggles: {
      autoplay: true
    },
    user
  });

export const apply = (ctx: Context) => {
  // Define localized messages
  ctx.i18n.define('zh-CN', {
    // File handling messages
    respackSet: '已设置资源包：{0}',
    chartFileAdded: '已添加谱面文件：{0}',

    // Start command messages
    existingRequest: '当前存在受理中的请求。',
    startInstructions:
      '您正在发起一个新的 PhiZone Player 代理（PZPA）请求。目前，PZPA 可以协助您完成谱面渲染。\n接下来，您将需要设置请求的输入，包括谱面、资源包以及代理配置。\n首先，请发送谱面相关文件（可以直接发送 ZIP 格式的谱面压缩包，也可以逐个发送谱面文件、曲目文件与曲绘文件等散装文件）。\n在发送完毕谱面相关文件后，如果希望使用自定义资源包，请发送 respack 指令并上传 1 个资源包 ZIP。\n随后，如有更改代理配置的需求，请使用 config 指令修改配置。\n一切准备就绪后，发送 submit 指令提交请求。',
    sendChartFiles: '请发送谱面相关文件。{0}',

    // Respack command messages
    startFirstRespack: '请先发送 start 指令。{0}',
    sendRespackFile: '请发送 PhiZone/Phira 格式的资源包文件。{0}',

    // Submit command messages
    startFirstSubmit: '请先发送 start 指令。{0}',
    needChartFiles: '请至少发送一个谱面文件。{0}',
    requestSummary: 'PhiZone Player 代理请求清单\n\n谱面文件：{0}\n\n资源包：{1}{2}',
    defaultRespack: '默认资源包',
    requestSubmitted: '成功发送请求『{0}』\n队列大小：{1}\n排队时间：至少 {2}\n请求用户：{3}{4}',

    // Progress command messages
    noActiveRequest: '当前没有受理中的请求。',
    progressInProgress: '请求 ID：『{0}』\n请求状态：{1}{2}{3}\n请求用户：{4}{5}',
    progressQueued: '请求 ID：『{0}』\n请求状态：排队中\n请求用户：{1}{2}',
    currentProgress: '当前进度：{0}',
    currentEta: '当前 ETA：{0}',

    // Cancel command messages
    cancelSuccess: '成功申请取消请求『{0}』。',
    cancelFailed: '取消请求失败：{0}',

    // History command messages
    historyEmpty: '请求历史为空。',
    noResults: '本页面无结果。',
    historyHeader: '历史请求（第 {0} 页，共 {1} 页）：\n',
    noOutput: '无结果',

    // Config command messages
    configInstructions:
      '请使用 config 配置项 [值] 指令修改您的代理配置。例如：\nconfig 分辨率 1620x1080 - 将"分辨率"设置为 1620x1080\nconfig 视频码率 12000 - 将"视频码率"设置为 12000 kbps\nconfig FC/AP指示器 - 开启或关闭"FC/AP指示器"（取决于您先前的配置）',
    unknownProperty: '未知的配置项：{0}',
    booleanToggled: '已将“{0}”的值修改为：{1}',
    valueSet: '已将“{0}”的值修改为：{1}',
    currentValue: '当前“{0}”的值为：{1}',
    resolutionError: '分辨率格式错误。请使用 宽x高 的格式，如：1620x1080。',
    chartFlippingError: '谱面翻转选项错误。可用选项：关闭、水平、竖直、水平与竖直。',
    numberError: '数值格式错误：{0}',
    booleanError: '布尔值格式错误。可用选项：开启、关闭。',
    on: '开启',
    off: '关闭',

    // WebSocket broadcast messages
    requestReceived:
      '请求『{0}』正在受理！请求结束后，我们将主动向您发送通知。\n您也可以通过 progress 指令查询请求进度。{1}',
    requestCompleted:
      'PhiZone Player 代理请求结束\n请求 ID：『{0}』\n请求状态：{1}\n请求用户：{2}\n请求结果：\n{3}\n我们将把以上文件发送到聊天中。请稍等片刻。{4}',
    requestEnded: 'PhiZone Player 代理请求结束\n请求 ID：『{0}』\n请求状态：{1}\n请求用户：{2}{3}',

    // Time units
    timeSeconds: ' 秒',
    timeMinutes: ' 分 ',
    timeHours: ' 时 ',

    // Status names
    'status.queued': '排队中',
    'status.initializing': '初始化中',
    'status.downloading_assets': '下载资源中',
    'status.starting': '启动中',
    'status.rendering': '渲染中',
    'status.mixing_audio': '混音中',
    'status.combining_streams': '合并音视频流中',
    'status.uploading_artifact': '上传工件中',
    'status.downloading_artifact': '下载工件中',
    'status.uploading_to_oss': '上传到文件存储服务中',
    'status.completed': '已完成',
    'status.failed': '已失败',
    'status.cancelled': '已取消',
    'status.unknown': '未知',

    // Config property names
    'config.mediaOptions.overrideResolution': '分辨率',
    'config.mediaOptions.frameRate': '帧率',
    'config.mediaOptions.videoCodec': '视频编码器',
    'config.mediaOptions.videoBitrate': '视频码率',
    'config.mediaOptions.audioBitrate': '音频码率',
    'config.mediaOptions.resultsLoopsToRender': '结算循环次数',
    'config.preferences.backgroundBlur': '背景模糊',
    'config.preferences.backgroundLuminance': '背景亮度',
    'config.preferences.chartFlipping': '谱面翻转',
    'config.preferences.chartOffset': '谱面偏移',
    'config.preferences.fcApIndicator': 'FC/AP指示器',
    'config.preferences.hitSoundVolume': '打击效果音量',
    'config.preferences.lineThickness': '线条粗细',
    'config.preferences.musicVolume': '音乐音量',
    'config.preferences.noteSize': '音符大小',
    'config.preferences.simultaneousNoteHint': '多押提示',
    'config.toggles.autoplay': '自动游玩',

    // Config summary labels
    'configSummary.title': 'PhiZone Player 代理配置',
    'configSummary.user': '用户：{0}',
    'configSummary.mediaOptions': '媒体选项：{0}',
    'configSummary.preferences': '游玩偏好：{0}',
    'configSummary.toggles': '开关：{0}',
    'configSummary.propertyColon': '：',
    'configSummary.enabled': '开启',
    'configSummary.disabled': '关闭',
    'configSummary.chartFlipping.off': '关闭',
    'configSummary.chartFlipping.horizontal': '水平',
    'configSummary.chartFlipping.vertical': '竖直',
    'configSummary.chartFlipping.both': '水平与竖直',
    'configSummary.chartFlipping.unknown': '未知'
  });

  ctx.i18n.define('en-US', {
    // File handling messages
    respackSet: 'Resource pack set: {0}',
    chartFileAdded: 'Chart file added: {0}',

    // Start command messages
    existingRequest: 'There is an active request in progress.',
    startInstructions:
      'You are initiating a new PhiZone Player Agent (PZPA) request. Currently, PZPA can assist you with chart rendering.\nNext, you will need to set up the request input, including charts, resource packs, and agent configuration.\nFirst, please send chart files (you can directly send ZIP format chart archives, or send chart files, audio files, and illustration files individually).\nAfter sending all chart files, if you wish to use a custom resource pack, please send the "respack" command and upload one resource pack ZIP.\nThen, if you need to modify the agent configuration, please use the "config" command to modify the configuration.\nOnce everything is ready, send the "submit" command to submit the request.',
    sendChartFiles: 'Please send chart files. {0}',

    // Respack command messages
    startFirstRespack: 'Please send the "start" command first. {0}',
    sendRespackFile: 'Please send PhiZone/Phira format resource pack file. {0}',

    // Submit command messages
    startFirstSubmit: 'Please send the "start" command first.',
    needChartFiles: 'Please send at least one chart file.',
    requestSummary:
      'PhiZone Player Agent Request Summary\n\nChart files: {0}\n\nResource pack: {1}{2}',
    defaultRespack: 'Default resource pack',
    requestSubmitted:
      'Successfully submitted request ｢{0}｣\nQueue size: {1}\nQueue time: at least {2}\nRequest user: {3} {4}',

    // Progress command messages
    noActiveRequest: 'No active request currently',
    progressInProgress: 'Request ID: ｢{0}｣\nRequest status: {1}{2}{3}\nRequest user: {4} {5}',
    progressQueued: 'Request ID: ｢{0}｣\nRequest status: Queued\nRequest user: {1} {2}',
    currentProgress: 'Current progress: {0}',
    currentEta: 'Current ETA: {0}',

    // Cancel command messages
    cancelSuccess: 'Successfully requested cancellation of ｢{0}｣',
    cancelFailed: 'Failed to cancel request: {0}',

    // History command messages
    historyEmpty: 'Request history is empty.',
    noResults: 'No results on this page.',
    historyHeader: 'Request history (page {0} of {1}):\n',
    noOutput: 'No results',

    // Config command messages
    configInstructions:
      'Please use "config property [value]" command to modify your agent configuration. For example:\nconfig Resolution 1620x1080 - Set "Resolution" to 1620x1080\nconfig VideoBitrate 12000 - Set "Video Bitrate" to 12000 kbps\nconfig FC/APIndicator - Toggle "FC/AP Indicator" (depending on your previous configuration)',
    unknownProperty: 'Unknown configuration property: {0}',
    booleanToggled: 'Changed "{0}" value to: {1}',
    valueSet: 'Set "{0}" value to: {1}',
    currentValue: 'Current "{0}" value: {1}',
    resolutionError: 'Resolution format error, please use width x height format, e.g.: 1620x1080.',
    chartFlippingError:
      'Chart flipping option error. Available options: off, horizontal, vertical, both.',
    numberError: 'Number format error: {0}',
    booleanError: 'Boolean format error. Available options: on, off.',
    on: 'on',
    off: 'off',

    // WebSocket broadcast messages
    requestReceived:
      'Request ｢{0}｣ is being processed! After the request is completed, we will actively send you notifications.\nYou can also check the request progress through the "progress" command. {1}',
    requestCompleted:
      'PhiZone Player Agent request completed\nRequest ID: ｢{0}｣\nRequest status: {1}\nRequest user: {2}\nRequest results:\n{3}\nWe will send the above files to the chat. Please wait a moment. {4}',
    requestEnded:
      'PhiZone Player Agent request ended\nRequest ID: ｢{0}｣\nRequest status: {1}\nRequest user: {2} {3}',

    // Time units
    timeSeconds: 's',
    timeMinutes: 'm ',
    timeHours: 'h ',

    // Status names
    'status.queued': 'Queued',
    'status.initializing': 'Initializing',
    'status.downloading_assets': 'Downloading Assets',
    'status.starting': 'Starting',
    'status.rendering': 'Rendering',
    'status.mixing_audio': 'Mixing Audio',
    'status.combining_streams': 'Combining Streams',
    'status.uploading_artifact': 'Uploading Artifact',
    'status.downloading_artifact': 'Downloading Artifact',
    'status.uploading_to_oss': 'Uploading to OSS',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.cancelled': 'Cancelled',
    'status.unknown': 'Unknown',

    // Config property names
    'config.mediaOptions.overrideResolution': 'Resolution',
    'config.mediaOptions.frameRate': 'Frame Rate',
    'config.mediaOptions.videoCodec': 'Video Codec',
    'config.mediaOptions.videoBitrate': 'Video Bitrate',
    'config.mediaOptions.audioBitrate': 'Audio Bitrate',
    'config.mediaOptions.resultsLoopsToRender': 'Results Loops to Render',
    'config.preferences.backgroundBlur': 'Background Blur',
    'config.preferences.backgroundLuminance': 'Background Luminance',
    'config.preferences.chartFlipping': 'Chart Flipping',
    'config.preferences.chartOffset': 'Chart Offset',
    'config.preferences.fcApIndicator': 'FC/AP Indicator',
    'config.preferences.hitSoundVolume': 'Hit Sound Volume',
    'config.preferences.lineThickness': 'Line Thickness',
    'config.preferences.musicVolume': 'Music Volume',
    'config.preferences.noteSize': 'Note Size',
    'config.preferences.simultaneousNoteHint': 'Simultaneous Note Hint',
    'config.toggles.autoplay': 'Autoplay',

    // Config summary labels
    'configSummary.title': 'PhiZone Player Agent Configuration',
    'configSummary.user': 'User: {0}',
    'configSummary.mediaOptions': 'Media Options: {0}',
    'configSummary.preferences': 'Play Preferences: {0}',
    'configSummary.toggles': 'Toggles: {0}',
    'configSummary.propertyColon': ': ',
    'configSummary.enabled': 'enabled',
    'configSummary.disabled': 'disabled',
    'configSummary.chartFlipping.off': 'off',
    'configSummary.chartFlipping.horizontal': 'horizontal',
    'configSummary.chartFlipping.vertical': 'vertical',
    'configSummary.chartFlipping.both': 'both',
    'configSummary.chartFlipping.unknown': 'unknown'
  });

  const getFileUrl = async (
    file?: { fileId: string; chatId: string; isPrivate: boolean },
    session?: Session<never, never, Context>
  ) => {
    if (!file || !session) return;
    const { fileId, chatId, isPrivate } = file;
    return await (isPrivate
      ? (session.bot as OneBotBot<Context>).internal.getPrivateFileUrl(chatId, fileId)
      : (session.bot as OneBotBot<Context>).internal.getGroupFileUrl(chatId, fileId, 0));
  };

  const validateSocket = async (target: string) => {
    const addr = target.split('/');
    const [prefix, user, runId] = addr;
    const room = (await ctx.database.get('pzpAgentRoom', user)).at(0);
    if (!room) return;
    const [rPrefix, rUser, rRunId] = room.addr;
    if (prefix !== rPrefix || user !== rUser || runId !== rRunId) return;
    return { prefix, user, runId };
  };

  const formatTime = (seconds: number, session: Session) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return [
      hours > 0 ? `${hours}${session.text('timeHours')}` : '',
      minutes % 60 > 0 ? `${minutes % 60}${session.text('timeMinutes')}` : '',
      seconds % 60 >= 0 ? `${(seconds % 60).toFixed(0)}${session.text('timeSeconds')}` : ''
    ]
      .filter(Boolean)
      .join('');
  };

  const pendingRuns: Record<
    string,
    {
      expectRespack: boolean;
      input: RunInput<{
        fileName: string;
        fileId: string;
        chatId: string;
        isPrivate: boolean;
      }>;
    }
  > = {};

  const client = new Client(ctx.config.apiBase, ctx.config.apiSecret);

  ctx.model.extend(
    'pzpAgentConfig',
    {
      id: 'integer',
      mediaOptions: 'json',
      preferences: 'json',
      toggles: 'json',
      user: 'string'
    },
    {
      primary: 'id',
      autoInc: true
    }
  );

  ctx.model.extend(
    'pzpAgentRoom',
    {
      user: 'string',
      addr: 'json',
      event: 'json',
      payload: 'json'
    },
    {
      primary: 'user'
    }
  );

  ctx.on('message', async (session) => {
    const user = session.event.user.id;
    const element = session.event.message.elements.at(0);
    if (!pendingRuns[user] || element?.type !== 'file') return;
    const isPrivate = session.event.channel.type === 1;
    const chatId = session.event.channel.id;
    console.log(element);
    const file = {
      fileName: element.attrs.fileName,
      fileId: element.attrs.fileId,
      chatId,
      isPrivate
    };
    if (pendingRuns[user].expectRespack) {
      pendingRuns[user].input.respack = file;
      pendingRuns[user].expectRespack = false;
      await session.send(session.text('respackSet', [file.fileName]));
    } else {
      pendingRuns[user].input.chartFiles.push(file);
      await session.send(session.text('chartFileAdded', [file.fileName]));
    }
  });

  ctx
    .command('pzp-agent')
    .subcommand('start')
    .alias('render', '开始', '渲染', '渲', '录制', '录')
    .action(async ({ session }) => {
      const user = session.event.user.id;
      const { total, runs } = await client.getRuns(user, 1, 1);
      if (total > 0 && !runs[0].dateCompleted) {
        await session.send(session.text('existingRequest'));
        await session.execute('progress');
        return;
      }
      await session.send(session.text('startInstructions'));
      await session.sendQueued(session.text('sendChartFiles', [h('at', { id: user })]));
      pendingRuns[user] = {
        expectRespack: false,
        input: {
          chartFiles: [],
          respack: undefined
        }
      };
    });

  ctx
    .command('pzp-agent')
    .subcommand('respack')
    .alias('res', 'resource-pack', '资源包')
    .action(({ session }) => {
      const user = session.event.user.id;
      if (!pendingRuns[user]) return session.text('startFirstRespack', [h('at', { id: user })]);
      pendingRuns[user].expectRespack = true;
      return session.text('sendRespackFile', [h('at', { id: user })]);
    });

  ctx
    .command('pzp-agent')
    .subcommand('submit')
    .alias('confirm', '提交', '确认')
    .action(async ({ session }) => {
      const user = session.event.user.id;
      if (!pendingRuns[user]) {
        await session.send(session.text('startFirstSubmit', [h('at', { id: user })]));
        return;
      }
      const config = await getConfig(user, ctx);
      if (pendingRuns[user].input.chartFiles.length === 0) {
        await session.send(session.text('needChartFiles', [h('at', { id: user })]));
        pendingRuns[user].expectRespack = false;
        return;
      }
      const chartFilesText = pendingRuns[user].input.chartFiles
        .map((file) => file.fileName)
        .join(', ');
      const respackText = pendingRuns[user].input.respack
        ? pendingRuns[user].input.respack.fileName
        : session.text('defaultRespack');
      await session.send(
        session.text('requestSummary', [
          chartFilesText,
          respackText,
          getConfigSummary(config, session, false)
        ])
      );
      const input = {
        chartFiles: await Promise.all(
          pendingRuns[user].input.chartFiles.map((file) => getFileUrl(file, session))
        ),
        respack: await getFileUrl(pendingRuns[user].input.respack, session)
      };
      const run: Run = {
        input,
        ...config
      };
      const { runId, prefix, queueSize, queueTime } = await client.newRun(run);
      await session.send(
        session.text('requestSubmitted', [
          runId,
          queueSize,
          formatTime(queueTime, session),
          user,
          h('at', { id: user })
        ])
      );
      socket.emit('join', prefix, user, runId);
      const room = {
        addr: [prefix, user, runId],
        event: session.event,
        payload: {
          status: 'queued',
          progress: 0,
          eta: 0
        }
      } as Room;
      try {
        await ctx.database.create('pzpAgentRoom', {
          user,
          ...room
        });
      } catch {
        await ctx.database.set('pzpAgentRoom', user, room);
      }
      ctx.logger.info(`Submitted Agent request for user ${user} from ${session.event.channel.id}`);
      delete pendingRuns[user];
    });

  ctx
    .command('pzp-agent')
    .subcommand('progress')
    .alias('prg', '进度', '查询进度')
    .action(async ({ session }) => {
      const user = session.event.user.id;
      const { total, runs } = await client.getRuns(user, 1, 1);
      if (total === 0 || runs[0].dateCompleted) {
        await session.send(session.text('noActiveRequest'));
        return;
      }
      const run = runs[0];
      if (run.status === 'in_progress') {
        const { status, progress, eta } = await client.getRunProgress(run.id, user);
        const progressText = progress
          ? `\n${session.text('currentProgress', [toPercent(progress)])}`
          : '';
        const etaText = eta ? `\n${session.text('currentEta', [formatTime(eta, session)])}` : '';
        await session.send(
          session.text('progressInProgress', [
            run.id,
            session.text(`status.${status}`),
            progressText,
            etaText,
            user,
            h('at', { id: user })
          ])
        );
      } else if (run.status === 'queued') {
        await session.send(session.text('progressQueued', [run.id, user, h('at', { id: user })]));
      }
    });

  ctx
    .command('pzp-agent')
    .subcommand('cancel')
    .alias('abort', 'terminate', 'stop', '取消', '中止', '终止', '停止')
    .action(async ({ session }) => {
      const user = session.event.user.id;
      const { total, runs } = await client.getRuns(user, 1, 1);
      if (total === 0 || runs[0].dateCompleted) {
        await session.send(session.text('noActiveRequest'));
        return;
      }
      const id = runs[0].id;
      try {
        await client.cancelRun(id, user);
        await session.send(session.text('cancelSuccess', [id]));
      } catch (error) {
        await session.send(session.text('cancelFailed', [error.message]));
      }
    });

  ctx
    .command('pzp-agent')
    .subcommand('runs [page] [limit]')
    .alias('history', '历史请求', '请求历史', '请求')
    .action(async ({ session }, page = '1', limit = '3') => {
      const user = session.event.user.id;
      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 5);
      const { total, runs } = await client.getRuns(user, pageNum, limitNum);
      if (total === 0) {
        await session.send(session.text('historyEmpty'));
        return;
      }
      if (runs.length === 0) {
        await session.send(session.text('noResults'));
        return;
      }
      const historyContent = runs
        .map(
          (run, i) =>
            `\n${i + 1 + (pageNum - 1) * limitNum}. [${session.text(`status.${run.status}`)}]『${run.id}』\n${
              run.outputFiles.length > 0
                ? run.outputFiles
                    .map((file) => `· ${file.name.substring(run.id.length + 3)}\n  ${file.url}`)
                    .join('\n')
                : session.text('noOutput')
            }\n`
        )
        .join('');
      await session.send(session.text('historyHeader', [pageNum, Math.ceil(total / limitNum)]));
      await session.send(historyContent);
    });

  ctx
    .command('pzp-agent')
    .subcommand('config <property> [value]')
    .alias('配置', '设置')
    .action(async ({ session }, property, value) => {
      const user = session.event.user.id;
      const config = await getConfig(user, ctx);
      if (!property) {
        await session.send(getConfigSummary(config, session));
        await session.send(session.text('configInstructions'));
        return;
      }

      const propertyPath = configLocalizedNameMap[property.toLowerCase()];
      if (!propertyPath) {
        await session.send(session.text('unknownProperty', [property]));
        return;
      }

      const currentValue = getNestedProperty(config, propertyPath);

      // Handle boolean toggle
      if (typeof currentValue === 'boolean' && !value) {
        setNestedProperty(config, propertyPath, !currentValue);
        const newValueText = currentValue ? session.text('off') : session.text('on');
        await session.send(
          session.text('booleanToggled', [session.text(`config.${propertyPath}`), newValueText])
        );
      } else if (value) {
        // Parse and set the new value
        let parsedValue: unknown = value;

        // Special handling for different property types
        if (propertyPath === 'mediaOptions.overrideResolution') {
          // Handle resolution format like "1620x1080"
          const match = value.match(/^(\d+)x(\d+)$/);
          if (match) {
            parsedValue = [parseInt(match[1]), parseInt(match[2])];
          } else {
            await session.send(session.text('resolutionError'));
            return;
          }
        } else if (propertyPath === 'preferences.chartFlipping') {
          // Handle chart flipping options
          const flippingMap: Record<string, number> = {
            关闭: 0,
            off: 0,
            水平: 1,
            horizontal: 1,
            竖直: 2,
            vertical: 2,
            水平与竖直: 3,
            both: 3
          };
          if (value in flippingMap) {
            parsedValue = flippingMap[value];
          } else {
            await session.send(session.text('chartFlippingError'));
            return;
          }
        } else if (typeof currentValue === 'number') {
          // Handle numeric values
          parsedValue = parseFloat(value);
          if (isNaN(parsedValue as number)) {
            await session.send(session.text('numberError', [value]));
            return;
          }
        } else if (typeof currentValue === 'boolean') {
          // Handle boolean values
          const boolMap: Record<string, boolean> = {
            开启: true,
            关闭: false,
            on: true,
            off: false,
            true: true,
            false: false,
            '1': true,
            '0': false
          };
          if (value in boolMap) {
            parsedValue = boolMap[value];
          } else {
            await session.send(session.text('booleanError'));
            return;
          }
        }

        setNestedProperty(config, propertyPath, parsedValue);
        const displayValue = Array.isArray(parsedValue) ? parsedValue.join('x') : parsedValue;
        await session.send(
          session.text('valueSet', [session.text(`config.${propertyPath}`), displayValue])
        );
      } else {
        const displayValue =
          typeof currentValue === 'boolean'
            ? currentValue
              ? session.text('on')
              : session.text('off')
            : Array.isArray(currentValue)
              ? currentValue.join('x')
              : currentValue;
        await session.send(
          session.text('currentValue', [session.text(`config.${propertyPath}`), displayValue])
        );
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, ...data } = config;
      await ctx.database.set('pzpAgentConfig', { user }, data);
    });

  const socket = io(ctx.config.apiWebsocket);
  socket.on('connect', () => {
    ctx.logger.info('Connected to API WebSocket');
  });
  socket.on('disconnect', () => {
    ctx.logger.info('Disconnected from API WebSocket');
  });
  socket.on('error', (err) => {
    ctx.logger.error('API WebSocket error:', err);
  });
  socket.on('message', async (target: string, status: string, progress: number, eta: number) => {
    ctx.logger.info(`Received update for ${target}: ${status} ${toPercent(progress)} ${eta}`);
    const result = await validateSocket(target);
    if (!result) return;
    const { user, runId } = result;
    await ctx.database.set('pzpAgentRoom', user, {
      payload: { status, progress, eta }
    });
    const event = await ctx.database.get('pzpAgentRoom', user).then((rooms) => rooms?.at(0)?.event);
    const session = ctx.bots[0].session(event);
    if (status === 'initializing') {
      await session.send(session.text('requestReceived', [runId, h('at', { id: user })]));
    } else if (['completed', 'failed', 'cancelled'].includes(status)) {
      if (status === 'completed') {
        const run = await client.getRun(runId, user);
        const outputText = run.outputFiles
          .map((file) => `· ${file.name.substring(run.id.length + 3)}\n  ${file.url}`)
          .join('\n');
        await session.send(
          session.text('requestCompleted', [
            runId,
            session.text(`status.${status}`),
            user,
            outputText,
            h('at', { id: user })
          ])
        );
        const isPrivate = event.channel.type === 1;
        const chatId = parseInt(event.channel.id);
        for (const file of run.outputFiles) {
          const tempDir = os.tmpdir();
          const tempFilePath = path.join(tempDir, Date.now().toString());
          const response = await fetch(file.url);
          if (!response.ok) throw new Error(`Failed to download file: ${file.url}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          await fs.writeFile(tempFilePath, buffer);
          try {
            await (isPrivate
              ? (session.bot as OneBotBot<Context>).internal.uploadPrivateFile(
                  chatId,
                  tempFilePath,
                  file.name
                )
              : (session.bot as OneBotBot<Context>).internal.uploadGroupFile(
                  chatId,
                  tempFilePath,
                  file.name
                ));
          } catch (error) {
            ctx.logger.error('Failed to upload file:', error);
          } finally {
            await fs.unlink(tempFilePath);
          }
        }
      } else {
        await session.send(
          session.text('requestEnded', [
            runId,
            session.text(`status.${status}`),
            user,
            h('at', { id: user })
          ])
        );
      }
    }
  });

  ctx.on('dispose', () => {
    socket.disconnect();
  });
};
