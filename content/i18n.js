(() => {
  const uiLanguage = (chrome.i18n?.getUILanguage?.() || navigator.language || 'en').toLowerCase();
  const locale = uiLanguage.startsWith('ko') ? 'ko' : 'en';
  const timeLocale = locale === 'ko' ? 'ko-KR' : 'en-US';

  function msg(key, substitutions) {
    const values = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    return chrome.i18n?.getMessage?.(key, values) || '';
  }

  function formatReset(iso) {
    if (!iso) return '';
    const ms = new Date(iso) - Date.now();
    if (ms <= 0) return msg('resetSoon');
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 24) {
      return msg('resetInDaysHours', [String(Math.floor(h / 24)), String(h % 24)]);
    }
    return h > 0 ? msg('resetInHoursMinutes', [String(h), String(m)]) : msg('resetInMinutes', String(m));
  }

  function formatTime(value, options) {
    return new Date(value).toLocaleTimeString(timeLocale, options);
  }

  function localizeLabel(label) {
    const source = String(label ?? '');
    if (!source) return source;

    if (locale === 'ko') {
      const replacements = [
        [/Workspace Agents/gi, '워크스페이스 에이전트'],
        [/Session \(5 hours\)/gi, '세션 (5시간)'],
        [/Weekly total/gi, '주간 전체'],
        [/Weekly limit/gi, '주간 한도'],
        [/Work usage/gi, '작업 사용량'],
        [/Deep research/gi, '딥 리서치'],
        [/Image generation/gi, '이미지 생성'],
        [/File upload/gi, '파일 업로드'],
        [/Advanced voice/gi, '고급 음성'],
        [/Text to file/gi, '텍스트→파일 변환'],
        [/Model limit/gi, '모델 한도'],
        [/\bAgents\b/gi, '에이전트'],
        [/\bImagine\b/gi, '이미지'],
        [/\bBuild\b/gi, '빌드'],
        [/\bWeekly\b/gi, '주간'],
        [/\bChat\b/gi, '채팅'],
        [/\bOther\b/gi, '기타'],
      ];
      let translated = source;
      for (const [pattern, replacement] of replacements) translated = translated.replace(pattern, replacement);
      return translated
        .replace(/(\d+)\s+days?/gi, '$1일')
        .replace(/(\d+)\s+hours?/gi, '$1시간');
    }

    const replacements = [
      ['텍스트→파일 변환', 'Text to file'],
      ['세션 (5시간)', 'Session (5 hours)'],
      ['작업 사용량', 'Work usage'],
      ['주간 전체', 'Weekly total'],
      ['주간 한도', 'Weekly limit'],
      ['딥 리서치', 'Deep research'],
      ['이미지 생성', 'Image generation'],
      ['파일 업로드', 'File upload'],
      ['고급 음성', 'Advanced voice'],
      ['모델 한도', 'Model limit'],
      ['주간', 'Weekly'],
      ['채팅', 'Chat'],
      ['기타', 'Other'],
    ];
    let translated = source;
    for (const [from, to] of replacements) translated = translated.replaceAll(from, to);
    translated = translated
      .replace(/(\d+)일/g, (_match, value) => `${value} ${value === '1' ? 'day' : 'days'}`)
      .replace(/(\d+)시간/g, (_match, value) => `${value} ${value === '1' ? 'hour' : 'hours'}`);
    return translated;
  }

  function setDocumentLanguage(root = document.documentElement) {
    if (root) root.lang = locale;
  }

  globalThis.__aumI18n = {
    locale,
    timeLocale,
    msg,
    formatReset,
    formatTime,
    localizeLabel,
    setDocumentLanguage,
  };
})();
