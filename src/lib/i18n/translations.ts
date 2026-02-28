export const translations = {
  en: {
    appTitle: "ALPHA TERMINAL",
    appSubtitle: "AI-Powered Financial Intelligence",
    runAnalysis: "RUN ANALYSIS",
    selectModel: "Select Model",
    loading: "Processing...",
    ready: "Ready",
    welcome: "Select a module to begin analysis",
    welcomeDesc:
      "Each module provides AI-powered insights using real-time web data. Choose a module from the sidebar or below to get started.",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeAuto: "Auto",
    modules: {
      "macro-landscape": "Macro Landscape",
      "insider-activity": "Insider Activity",
      "short-squeeze": "Short Squeeze",
      "mna-radar": "M&A Radar",
      "sentiment-divergence": "Sentiment Divergence",
      "correlation-anomalies": "Correlation Anomalies",
      "dividend-traps": "Dividend Traps",
      "institutional-flow": "Institutional Flow",
      "portfolio-hedging": "Portfolio Hedging",
      "weekly-briefing": "Weekly Briefing",
    },
    moduleDescriptions: {
      "macro-landscape":
        "Current macro background, historical parallels, and sector implications",
      "insider-activity":
        "Significant insider buying signals from SEC filings",
      "short-squeeze":
        "High short interest stocks with upcoming catalysts",
      "mna-radar":
        "Acquisition rumors and high-probability M&A targets",
      "sentiment-divergence":
        "Stocks where negative sentiment diverges from solid fundamentals",
      "correlation-anomalies":
        "Unusual asset correlations and what they signal",
      "dividend-traps":
        "High-yield stocks with warning signs of dividend cuts",
      "institutional-flow":
        "Hedge fund 13F positioning and sector flows",
      "portfolio-hedging":
        "Hedging strategies using options and inverse ETFs",
      "weekly-briefing":
        "Executive summary of the week's key events and ideas",
    },
  },
  zh: {
    appTitle: "阿尔法终端",
    appSubtitle: "AI驱动的金融情报平台",
    runAnalysis: "运行分析",
    selectModel: "选择模型",
    loading: "处理中...",
    ready: "就绪",
    welcome: "选择一个模块开始分析",
    welcomeDesc:
      "每个模块使用实时网络数据提供AI驱动的洞察。从侧边栏或下方选择一个模块开始。",
    theme: "主题",
    themeLight: "浅色",
    themeDark: "深色",
    themeAuto: "自动",
    modules: {
      "macro-landscape": "宏观全景",
      "insider-activity": "内部人交易",
      "short-squeeze": "空头挤压",
      "mna-radar": "并购雷达",
      "sentiment-divergence": "情绪背离",
      "correlation-anomalies": "相关性异常",
      "dividend-traps": "股息陷阱",
      "institutional-flow": "机构资金流",
      "portfolio-hedging": "投资组合对冲",
      "weekly-briefing": "每周简报",
    },
    moduleDescriptions: {
      "macro-landscape": "当前宏观背景、历史类比及板块影响",
      "insider-activity": "来自SEC文件的重大内部人买入信号",
      "short-squeeze": "高空头兴趣股票及即将到来的催化剂",
      "mna-radar": "收购传闻及高概率并购目标",
      "sentiment-divergence": "负面情绪与坚实基本面背离的股票",
      "correlation-anomalies": "异常资产相关性及其信号含义",
      "dividend-traps": "高收益率股票的股息削减警告信号",
      "institutional-flow": "对冲基金13F持仓及板块资金流",
      "portfolio-hedging": "使用期权和反向ETF的对冲策略",
      "weekly-briefing": "本周关键事件和交易想法的执行摘要",
    },
  },
};

export type Translations = (typeof translations)["en"];
