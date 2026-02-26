import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import {
  clearAuthTokens,
  deleteConversation,
  editChatMessage,
  getConversation,
  getConversations,
  getCurrentUser,
  getStoredAccessToken,
  login,
  sendMessage,
  signup,
  updateCurrentUser,
  uploadReport,
} from './src/api/client';

const LANDING_TABS = ['home', 'about', 'help'];
const LANGS = ['auto', 'en-US', 'hi-IN', 'gu-IN'];
const SUGGESTED = [
  'I have fever and body pain',
  'I have cough and sore throat',
  'I have weight change and hair fall',
  'I feel rapid heartbeat',
];
const STOP_WORDS = new Set([
  'i', 'have', 'am', 'is', 'are', 'the', 'a', 'an', 'and', 'or',
  'to', 'of', 'my', 'me', 'it', 'for', 'with', 'in',
]);

const THEME_KEY = 'mediassist_theme';
const LANG_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'English', value: 'en-US' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'Gujarati', value: 'gu-IN' },
];

const SPEECH_LANG_MAP = {
  auto: 'en-US',
  'en-US': 'en-US',
  'hi-IN': 'hi-IN',
  'gu-IN': 'gu-IN',
};

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const GUJARATI_RE = /[\u0A80-\u0AFF]/;
const ROMAN_WORD_RE = /^[a-z\s.,!?'"-]+$/i;

const HINDI_ROMAN_MAP = [
  ['mujhe', 'मुझे'],
  ['muje', 'मुझे'],
  ['mujhko', 'मुझको'],
  ['bukhaar', 'बुखार'],
  ['bukhar', 'बुखार'],
  ['jukaam', 'जुकाम'],
  ['jukham', 'जुकाम'],
  ['jukam', 'जुकाम'],
  ['khansi', 'खांसी'],
  ['khasi', 'खांसी'],
  ['sardi', 'सर्दी'],
  ['gala', 'गला'],
  ['dard', 'दर्द'],
  ['pet', 'पेट'],
  ['sir', 'सिर'],
  ['mere', 'मेरे'],
  ['mera', 'मेरा'],
  ['bal', 'बाल'],
  ['baal', 'बाल'],
  ['aur', 'और'],
  ['mein', 'मैं'],
  ['main', 'मैं'],
  ['mai', 'मैं'],
  ['nahi', 'नहीं'],
  ['hai', 'है'],
];

const GUJARATI_ROMAN_MAP = [
  ['mane', 'મને'],
  ['mne', 'મને'],
  ['taav', 'તાવ'],
  ['tav', 'તાવ'],
  ['jukaam', 'જુકામ'],
  ['jukham', 'જુકામ'],
  ['jukam', 'જુકામ'],
  ['khansi', 'ખાંસી'],
  ['sardi', 'શરદી'],
  ['dard', 'દર્દ'],
  ['pet', 'પેટ'],
  ['mathu', 'માથું'],
  ['maare', 'મારે'],
  ['mare', 'મારે'],
  ['nathi', 'નથી'],
  ['ane', 'અને'],
  ['chhe', 'છે'],
  ['che', 'છે'],
  ['chu', 'છું'],
];

function normalizeRomanIndic(text, selectedLang) {
  const input = String(text || '');
  const value = input.trim();
  if (!value) return input;

  const langKey = String(selectedLang || '').toLowerCase();
  const isHindi = langKey.startsWith('hi');
  const isGujarati = langKey.startsWith('gu');
  if (!isHindi && !isGujarati) return input;

  if (isHindi && DEVANAGARI_RE.test(value)) return input;
  if (isGujarati && GUJARATI_RE.test(value)) return input;
  if (!ROMAN_WORD_RE.test(value)) return input;

  const map = isHindi ? HINDI_ROMAN_MAP : GUJARATI_ROMAN_MAP;
  let converted = ` ${value.toLowerCase()} `;
  let changed = false;
  map.forEach(([roman, nativeWord]) => {
    const pattern = new RegExp(`\\b${roman}\\b`, 'g');
    if (pattern.test(converted)) {
      changed = true;
      converted = converted.replace(pattern, nativeWord);
    }
  });
  if (!changed) return input;
  return converted.replace(/\s+/g, ' ').trim();
}

const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
};

function inferMimeType(name = '', uri = '', mimeType = '') {
  const rawType = String(mimeType || '').toLowerCase();
  if (rawType) return rawType;
  const source = `${name} ${uri}`.toLowerCase();
  if (source.includes('.pdf')) return 'application/pdf';
  if (source.includes('.png')) return 'image/png';
  if (source.includes('.jpg') || source.includes('.jpeg')) return 'image/jpeg';
  if (source.includes('.webp')) return 'image/webp';
  if (source.includes('.bmp')) return 'image/bmp';
  if (source.includes('.tif') || source.includes('.tiff')) return 'image/tiff';
  return 'application/octet-stream';
}

function buildUploadFile(asset) {
  const uri = asset?.uri || '';
  const guessedType = inferMimeType(asset?.name, uri, asset?.mimeType);
  const ext = Object.entries(MIME_TO_EXT).find(([mime]) => mime === guessedType)?.[1] || '';

  let name = (asset?.name || '').trim();
  if (!name && uri) {
    const uriName = uri.split('/').pop() || '';
    name = uriName.split('?')[0];
  }
  if (!name) {
    name = `report-${Date.now()}${ext}`;
  } else if (ext && !/\.[a-z0-9]+$/i.test(name)) {
    name = `${name}${ext}`;
  }

  return {
    uri,
    name,
    type: guessedType,
  };
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  if (!value) return new Date();
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function AppLogo({ subtitle = 'Healthcare SaaS Platform', small = false }) {
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoIcon}><Text style={styles.logoPlus}>+</Text></View>
      <View>
        <Text style={[styles.logoTitle, small && styles.logoTitleSmall]} numberOfLines={1}>MediAssist AI</Text>
        {subtitle ? <Text style={[styles.logoSub, small && styles.logoSubSmall]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function Landing({ onLogin, onSignup, onOpenAuthMode, palette, topOffset }) {
  const [tab, setTab] = useState('home');
  const landingScrollRef = useRef(null);
  const sectionOffsets = useRef({ home: 0, about: 0, help: 0 });
  const autoScrollingRef = useRef(false);

  const releaseAutoScroll = useCallback(() => {
    setTimeout(() => {
      autoScrollingRef.current = false;
    }, 180);
  }, []);

  const setSectionOffset = useCallback((id, event) => {
    sectionOffsets.current[id] = event.nativeEvent.layout.y;
  }, []);

  const getActiveSection = useCallback((scrollY) => {
    let active = 'home';
    LANDING_TABS.forEach((id) => {
      const offset = sectionOffsets.current[id] || 0;
      if (scrollY + 120 >= offset) active = id;
    });
    return active;
  }, []);

  const scrollToSection = useCallback((id) => {
    const y = Math.max(0, (sectionOffsets.current[id] || 0) - 8);
    autoScrollingRef.current = true;
    setTab(id);
    landingScrollRef.current?.scrollTo({ y, animated: true });
    releaseAutoScroll();
  }, [releaseAutoScroll]);

  const handleLandingScroll = useCallback((event) => {
    if (autoScrollingRef.current) return;
    const y = event.nativeEvent.contentOffset.y || 0;
    const active = getActiveSection(y);
    setTab((prev) => (prev === active ? prev : active));
  }, [getActiveSection]);

  const tabButton = (id, label) => (
    <Pressable
      key={id}
      style={[styles.navTab, tab === id && styles.navTabActive]}
      onPress={() => scrollToSection(id)}
    >
      <Text style={[styles.navTabText, tab === id && styles.navTabTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.landingRoot, { backgroundColor: palette.appBg }]}>
      <StatusBar style="light" />
      <View style={[styles.navbar, { backgroundColor: palette.headerBg, borderBottomColor: palette.border, paddingTop: 26 + topOffset }]}>
        <AppLogo />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
          {tabButton('home', 'Home')}
          {tabButton('about', 'About Us')}
          {tabButton('help', 'How It Helps')}
          <Pressable style={styles.navAction} onPress={() => { onOpenAuthMode('login'); onLogin(); }}>
            <Text style={styles.navActionText}>Login</Text>
          </Pressable>
          <Pressable style={styles.navActionPrimary} onPress={() => { onOpenAuthMode('signup'); onSignup(); }}>
            <Text style={styles.navActionPrimaryText}>Sign Up</Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        ref={landingScrollRef}
        contentContainerStyle={styles.landingBody}
        onScroll={handleLandingScroll}
        onMomentumScrollEnd={releaseAutoScroll}
        onScrollEndDrag={releaseAutoScroll}
        scrollEventThrottle={16}
      >
        <View onLayout={(event) => setSectionOffset('home', event)} style={styles.sectionWrap}>
          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroBadge}>AI-POWERED HEALTHCARE</Text>
              <Text style={styles.heroTitle}>Smart AI Health Companion</Text>
              <Text style={styles.heroDesc}>
                Instant symptom guidance, prescription insights, and multilingual voice support.
              </Text>
              <View style={styles.heroBtnRow}>
                <Pressable style={styles.heroPrimary} onPress={() => { onOpenAuthMode('signup'); onSignup(); }}>
                  <Text style={styles.heroPrimaryText}>Get Started</Text>
                </Pressable>
                <Pressable style={styles.heroSecondary} onPress={() => scrollToSection('about')}>
                  <Text style={styles.heroSecondaryText}>Learn More</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.panelTitle}>AI ASSISTANT</Text>
              <Text style={styles.panelText}>Real-time support for symptoms, prescriptions, reports, and multilingual care guidance.</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionSpacer} />
        <View onLayout={(event) => setSectionOffset('about', event)} style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>About Us</Text>
          <Text style={styles.sectionIntro}>MediAssist AI helps patients get clearer first-step guidance through healthcare-focused AI workflows.</Text>
          <View style={styles.infoCard}><Text style={styles.infoCardText}>Our mission: deliver accessible, trustworthy, and responsible AI support for better healthcare decisions.</Text></View>
          <View style={styles.gridTwo}>
            <View style={styles.featureBox}><Text style={styles.featureHead}>AI Symptom Matching</Text><Text style={styles.featureBody}>Fast symptom-to-condition mapping using structured healthcare FAQ intelligence.</Text></View>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Prescription Analysis</Text><Text style={styles.featureBody}>Extracts report and prescription insights with clear recommendations and alerts.</Text></View>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Multilingual Chat</Text><Text style={styles.featureBody}>Natural support across English, Hindi, and Gujarati.</Text></View>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Voice Assistant</Text><Text style={styles.featureBody}>Voice-enabled healthcare interaction for faster and accessible support.</Text></View>
          </View>
        </View>

        <View style={styles.sectionSpacer} />
        <View onLayout={(event) => setSectionOffset('help', event)} style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>How It Helps</Text>
          <Text style={styles.sectionIntro}>Purpose-built healthcare blocks for patient support, clarity, and safer follow-up.</Text>
          <View style={styles.gridTwo}>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Symptom FAQ Matching</Text><Text style={styles.featureBody}>Matches user symptoms against healthcare FAQ patterns.</Text></View>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Prescription Reading</Text><Text style={styles.featureBody}>Parses medicine and care information from medical documents.</Text></View>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Report Upload Analysis</Text><Text style={styles.featureBody}>Understands report content and returns practical care guidance.</Text></View>
            <View style={styles.featureBox}><Text style={styles.featureHead}>Secure Patient Data</Text><Text style={styles.featureBody}>Privacy-first healthcare workflows and safe chat history.</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthForm({ mode, error, pending, onSubmit, onBack, onSwitchMode }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.authRoot}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.authKeyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.authScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authPanel}>
            <Pressable style={styles.backGhost} onPress={onBack}><Text style={styles.backGhostText}>Back</Text></Pressable>
            <Text style={styles.authTitle}>Welcome to MediAssist AI</Text>
            <Text style={styles.authSub}>Login or sign up to continue to your chat assistant.</Text>

            <TextInput style={styles.authInput} placeholder="Username" placeholderTextColor="#94a5bf" value={username} onChangeText={setUsername} autoCapitalize="none" />
            {mode === 'signup' ? <TextInput style={styles.authInput} placeholder="Email" placeholderTextColor="#94a5bf" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /> : null}
            <TextInput style={styles.authInput} placeholder="Password" placeholderTextColor="#94a5bf" value={password} onChangeText={setPassword} secureTextEntry />

            {error ? <Text style={styles.err}>{error}</Text> : null}

            <Pressable
              style={styles.authBtn}
              onPress={() => onSubmit({ username, email, password })}
              disabled={pending}
            >
              {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.authBtnText}>{mode === 'login' ? 'Login' : 'Sign Up'}</Text>}
            </Pressable>

            <Text style={styles.switchText}>
              {mode === 'signup' ? 'Already have an account?' : 'New user?'}{' '}
              <Text style={styles.switchLink} onPress={onSwitchMode}>{mode === 'signup' ? 'Login' : 'Create account'}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const topOffset = Platform.OS === 'android' ? Math.max(8, Math.round((RNStatusBar.currentHeight || 0) * 0.7)) : 8;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('landing');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authPending, setAuthPending] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatError, setChatError] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [pendingReport, setPendingReport] = useState(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState(SUGGESTED);
  const [lang, setLang] = useState('auto');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messageInputRef = useRef(null);
  const messagesListRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);

  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({ username: '', email: '', dob: '', gender: '' });
  const [profileError, setProfileError] = useState('');
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobDate, setDobDate] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('default');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value) setTheme(value);
    });
  }, []);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await getCurrentUser();
      setUser(me);
      setProfile({ username: me.username || '', email: me.email || '', dob: me.dob || '', gender: me.gender || '' });
      setDobDate(parseDate(me.dob));
    } catch {
      await clearAuthTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const data = await getConversations();
    setConversations(data || []);
  }, [user]);

  const normalizeQuestion = useCallback(
    (text) => (text || '').toLowerCase().trim().replace(/\s+/g, ' '),
    [],
  );

  const stemToken = useCallback((token) => {
    let value = token;
    ['ing', 'edly', 'ed', 'ly', 'es', 's'].forEach((suffix) => {
      if (value.endsWith(suffix) && value.length > suffix.length + 2) {
        value = value.slice(0, -suffix.length);
      }
    });
    return value;
  }, []);

  const questionTokenSet = useCallback((text) => {
    const normalized = normalizeQuestion(text);
    const rawTokens = normalized.match(/[a-z0-9]+/g) || [];
    return new Set(
      rawTokens
        .map(stemToken)
        .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token)),
    );
  }, [normalizeQuestion, stemToken]);

  const jaccardSimilarity = useCallback((aSet, bSet) => {
    if (!aSet.size || !bSet.size) return 0;
    let intersection = 0;
    aSet.forEach((token) => {
      if (bSet.has(token)) intersection += 1;
    });
    const union = aSet.size + bSet.size - intersection;
    return union ? intersection / union : 0;
  }, []);

  const loadSuggestedQuestions = useCallback(async () => {
    if (!user) {
      setSuggestedQuestions(SUGGESTED);
      return;
    }

    try {
      const convs = await getConversations();
      const limited = (convs || []).slice(0, 30);
      const histories = await Promise.all(
        limited.map((conv) => getConversation(conv.id).catch(() => [])),
      );

      const groups = [];
      histories.flat().forEach((item) => {
        const question = (item?.message || '').trim();
        if (!question || question.startsWith('[Uploaded File]')) return;

        const tokens = questionTokenSet(question);
        if (!tokens.size) return;

        let bestIndex = -1;
        let bestScore = 0;
        groups.forEach((group, idx) => {
          const score = jaccardSimilarity(tokens, group.tokens);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = idx;
          }
        });

        if (bestIndex >= 0 && bestScore >= 0.55) {
          const current = groups[bestIndex];
          current.count += 1;
          if (question.length > current.text.length) {
            current.text = question;
            current.tokens = tokens;
          }
        } else {
          groups.push({ text: question, tokens, count: 1 });
        }
      });

      const top = groups
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((item) => item.text);

      setSuggestedQuestions(top.length ? top : SUGGESTED);
    } catch {
      setSuggestedQuestions(SUGGESTED);
    }
  }, [jaccardSimilarity, questionTokenSet, user]);

  const loadConversation = useCallback(async (id) => {
    setActiveConversation(id);
    setEditId(null);
    if (!id) {
      setMessages([]);
      return;
    }
    const data = await getConversation(id);
    setMessages(data || []);
    shouldAutoScrollRef.current = true;
    setHistoryOpen(false);
  }, []);

  const scrollMessagesToBottom = useCallback((animated = true) => {
    messagesListRef.current?.scrollToEnd?.({ animated });
  }, []);

  const queueAutoScroll = useCallback(() => {
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => scrollMessagesToBottom(true));
  }, [scrollMessagesToBottom]);

  useEffect(() => { boot(); }, [boot]);
  useEffect(() => {
    if (!user) return;
    refreshConversations().catch(() => setChatError('Unable to load conversations.'));
  }, [user, refreshConversations]);
  useEffect(() => {
    if (!user) return;
    loadSuggestedQuestions().catch(() => {});
  }, [user, loadSuggestedQuestions]);

  const handleAuth = async ({ username, email, password }) => {
    setAuthPending(true);
    setAuthError('');
    try {
      const me = authMode === 'login'
        ? await login((username || '').trim(), password || '')
        : await signup((username || '').trim(), (email || '').trim(), password || '');
      setUser(me);
      setProfile({ username: me.username || '', email: me.email || '', dob: me.dob || '', gender: me.gender || '' });
      setDobDate(parseDate(me.dob));
      setAuthView('landing');
      await refreshConversations();
    } catch (e) {
      setAuthError(e.message || 'Authentication failed.');
    } finally {
      setAuthPending(false);
    }
  };

  const handleLogout = async () => {
    await clearAuthTokens();
    setUser(null);
    setActiveConversation(null);
    setMessages([]);
    setConversations([]);
    setAuthView('landing');
    setAuthMode('login');
    setMenuOpen(false);
    setSettingsOpen(false);
    setProfileOpen(false);
  };

  const speakText = async (text) => {
    const spokenText = String(text || '').trim();
    if (!spokenText) return;

    const preferredLanguage = SPEECH_LANG_MAP[lang] || 'en-US';
    let resolvedLanguage = preferredLanguage;

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (Array.isArray(voices) && voices.length) {
        const exact = voices.find((voice) => voice?.language === preferredLanguage);
        if (exact?.language) {
          resolvedLanguage = exact.language;
        } else {
          const base = preferredLanguage.split('-')[0].toLowerCase();
          const partial = voices.find((voice) => String(voice?.language || '').toLowerCase().startsWith(base));
          if (partial?.language) {
            resolvedLanguage = partial.language;
          }
        }
      }
    } catch {
      // Keep preferred language fallback.
    }

    Speech.stop();
    Speech.speak(spokenText, {
      language: resolvedLanguage,
      rate: 1.0,
      onError: () => {
        // Final fallback: speak with device default voice.
        Speech.stop();
        Speech.speak(spokenText, { rate: 1.0 });
      },
    });
  };

  const handleSpeakerToggle = () => {
    setSpeakEnabled((prev) => {
      if (prev) Speech.stop();
      return !prev;
    });
  };

  const handleMicInput = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        Alert.alert('Voice Input', 'Speech recognition is not available in this browser.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'auto'
        ? 'en-US'
        : String(lang).toLowerCase().startsWith('hi')
          ? 'hi-IN'
          : String(lang).toLowerCase().startsWith('gu')
            ? 'gu-IN'
            : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setMessageInput((prev) => `${prev} ${transcript}`.trim());
        }
      };
      recognition.onerror = () => setChatError('Voice input failed. Please try again.');
      recognition.onend = () => setIsListening(false);
      recognition.start();
      return;
    }

    Alert.alert(
      'Voice Input',
      'Use your keyboard microphone for voice typing. Native STT mic is limited in Expo Go.'
    );
    messageInputRef.current?.focus?.();
  };

  const handleMessageInputChange = (value) => {
    setMessageInput(value);
  };

  const handleSend = async (textFromSuggestion = '') => {
    const baseText = (textFromSuggestion || messageInput).trim();
    const text = normalizeRomanIndic(baseText, lang).trim();
    if ((!text && !pendingReport) || chatPending) return;

    if (!textFromSuggestion) {
      messageInputRef.current?.blur?.();
      Keyboard.dismiss();
    }
    setChatPending(true);
    setChatError('');
    if (!textFromSuggestion) setMessageInput('');
    try {
      if (pendingReport) {
        const reportFile = pendingReport;
        const data = await uploadReport(reportFile, activeConversation, lang);
        if (!activeConversation && data.conversation_id) {
          setActiveConversation(data.conversation_id);
        }
        setMessages((prev) => [...prev, { id: data.chat_id || undefined, message: `[Uploaded File] ${reportFile.name}`, response: data.response }]);
        queueAutoScroll();
        setPendingReport(null);
        if (speakEnabled && data.response) {
          speakText(data.response);
        }
        await refreshConversations();
        await loadSuggestedQuestions();
        if (!text) return;
      }

      const data = await sendMessage(text, activeConversation, lang);
      if (!activeConversation && data.conversation_id) {
        setActiveConversation(data.conversation_id);
      }
      setMessages((prev) => [...prev, { id: data.chat_id, message: text, response: data.response }]);
      queueAutoScroll();
      if (speakEnabled && data.response) {
        speakText(data.response);
      }
      await refreshConversations();
      await loadSuggestedQuestions();
    } catch (e) {
      setChatError(e.message || 'Unable to send message.');
    } finally {
      setChatPending(false);
    }
  };

  const handleUpload = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.length) return;
      const a = pick.assets[0];
      const file = buildUploadFile(a);
      if (!file.uri) {
        setChatError('Unable to read selected file. Please select again.');
        return;
      }
      setPendingReport(file);
      setChatError('');
    } catch (e) {
      setChatError(e.message || 'Upload failed.');
    }
  };

  const handleDeleteConv = async (id) => {
    try {
      await deleteConversation(id);
      await refreshConversations();
      if (activeConversation === id) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (e) {
      setChatError(e.message || 'Delete failed.');
    }
  };

  const startEdit = (msg) => {
    if (!msg?.id) return;
    setEditId(msg.id);
    setEditText(msg.message || '');
  };

  const saveEdit = async (msg, index) => {
    const value = (editText || '').trim();
    if (!value || !msg?.id) return;
    try {
      const data = await editChatMessage(msg.id, value);
      setMessages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], message: data.message || value, response: data.response || next[index].response };
        return next.slice(0, index + 1);
      });
      queueAutoScroll();
      setEditId(null);
      setEditText('');
      await refreshConversations();
      await loadSuggestedQuestions();
    } catch (e) {
      setChatError(e.message || 'Edit failed.');
    }
  };

  const openProfile = () => {
    setMenuOpen(false);
    setProfileError('');
    if (!profile.gender) {
      setProfile((prev) => ({ ...prev, gender: 'prefer_not_to_say' }));
    }
    setDobDate(parseDate(profile.dob));
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    try {
      const updated = await updateCurrentUser(profile);
      setUser(updated);
      setProfile({ username: updated.username || '', email: updated.email || '', dob: updated.dob || '', gender: updated.gender || '' });
      setProfileOpen(false);
    } catch (e) {
      setProfileError(e.message || 'Profile update failed.');
    }
  };

  const selectTheme = async (value) => {
    setTheme(value);
    await AsyncStorage.setItem(THEME_KEY, value);
  };

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => (a.id < b.id ? 1 : -1)),
    [conversations],
  );

  const palette = useMemo(() => {
    if (theme === 'light') {
      return {
        appBg: '#eaf2ff',
        headerBg: '#d7e7ff',
        panelBg: '#ffffff',
        cardBg: '#edf4ff',
        border: '#9db7dc',
        text: '#19385f',
        subText: '#3a5980',
        accent: '#1f8fff',
        accentText: '#ffffff',
      };
    }
    if (theme === 'dark') {
      return {
        appBg: '#061226',
        headerBg: '#0d1d39',
        panelBg: '#122646',
        cardBg: '#1b2d4e',
        border: '#304d7a',
        text: '#eef5ff',
        subText: '#abc8ec',
        accent: '#2f84ff',
        accentText: '#ffffff',
      };
    }
    return {
      appBg: '#13234f',
      headerBg: '#1a2f66',
      panelBg: '#1f356c',
      cardBg: '#243665',
      border: '#3d5a95',
      text: '#eef5ff',
      subText: '#cfe0ff',
      accent: '#2ec1ff',
      accentText: '#123f66',
    };
  }, [theme]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loaderRoot, { backgroundColor: palette.appBg }]}><ActivityIndicator size="large" color={palette.accent} /></SafeAreaView>
    );
  }

  if (!user) {
    if (authView === 'landing') {
      return (
        <Landing
          onLogin={() => setAuthView('auth')}
          onSignup={() => setAuthView('auth')}
          onOpenAuthMode={setAuthMode}
          palette={palette}
          topOffset={topOffset}
        />
      );
    }

    return (
      <AuthForm
        mode={authMode}
        error={authError}
        pending={authPending}
        onSubmit={handleAuth}
        onBack={() => setAuthView('landing')}
        onSwitchMode={() => setAuthMode((p) => (p === 'login' ? 'signup' : 'login'))}
      />
    );
  }

  const historyList = (
    <View style={[styles.sidebar, { backgroundColor: palette.panelBg, borderRightColor: palette.border }]}>
      <Pressable style={[styles.newChat, { backgroundColor: palette.accent }]} onPress={() => loadConversation(null)}>
        <Text style={[styles.newChatText, { color: palette.accentText }]}>+ New Chat</Text>
      </Pressable>
      <FlatList
        data={sortedConversations}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <Pressable style={[styles.convItem, { backgroundColor: palette.cardBg, borderColor: palette.border }, activeConversation === item.id && { borderColor: palette.accent }]} onPress={() => loadConversation(item.id)}>
            <Text numberOfLines={2} style={[styles.convText, { color: palette.text }]}>{item.first_message || `Conversation ${item.id}`}</Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Delete conversation?',
                  'This conversation will be removed from your history.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => handleDeleteConv(item.id),
                    },
                  ]
                )
              }
            >
              <Text style={styles.convDelete}>Delete</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.chatRoot, { backgroundColor: palette.appBg }]}>
      <StatusBar style="light" />
      <View style={[styles.chatHeader, { backgroundColor: palette.headerBg, borderBottomColor: palette.border, paddingTop: 18 + topOffset }]}>
        <View style={styles.chatHeaderLeft}>
          {isCompact ? (
            <Pressable style={[styles.hamBtn, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={() => setHistoryOpen(true)}>
              <Text style={[styles.hamText, { color: palette.text }]}>☰</Text>
            </Pressable>
          ) : null}
          <AppLogo subtitle={isCompact ? '' : 'Smart Patient Companion'} small={isCompact} />
        </View>
        <Pressable style={[styles.avatarBtn, { backgroundColor: palette.accent }]} onPress={() => setMenuOpen((prev) => !prev)}>
          <Text style={[styles.avatarText, { color: palette.accentText }]}>{(user.username || 'U').slice(0, 1).toUpperCase()}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={0}
      >
        {!isCompact ? historyList : null}

        <View style={styles.chatMain}>
          {messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Hello, how can I help you today?</Text>
              <Text style={styles.emptySub}>Ask about symptoms, medicines, home care, or upload a report.</Text>
              {suggestedQuestions.map((q) => (
                <Pressable key={q} style={styles.suggestCard} onPress={() => handleSend(q)}>
                  <Text style={styles.suggestText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <FlatList
              ref={messagesListRef}
              data={messages}
              keyExtractor={(item, idx) => String(item.id || idx)}
              contentContainerStyle={styles.msgList}
              onContentSizeChange={() => {
                if (shouldAutoScrollRef.current) {
                  scrollMessagesToBottom(true);
                  shouldAutoScrollRef.current = false;
                }
              }}
              renderItem={({ item, index }) => (
                <View style={styles.msgPair}>
                  {editId !== null && editId === item.id ? (
                    <View style={styles.editWrap}>
                      <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} />
                      <View style={styles.editActions}>
                        <Pressable style={styles.smallBlue} onPress={() => saveEdit(item, index)}><Text style={styles.smallBlueText}>Resend</Text></Pressable>
                        <Pressable style={styles.smallGhost} onPress={() => { setEditId(null); setEditText(''); }}><Text style={styles.smallGhostText}>Cancel</Text></Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.userRow}>
                      <View style={[styles.bubble, styles.userBubble]}><Text style={styles.userText}>{item.message}</Text></View>
                      {item.id ? <Pressable onPress={() => startEdit(item)}><Text style={styles.editLink}>Edit</Text></Pressable> : null}
                    </View>
                  )}
                  <View style={[styles.bubble, styles.botBubble]}><Text style={styles.botText}>{item.response}</Text></View>
                </View>
              )}
            />
          )}

          {chatError ? <Text style={styles.err}>{chatError}</Text> : null}

          <View style={[styles.composer, isCompact && styles.composerLifted, { backgroundColor: palette.panelBg, borderColor: palette.border }]}>
            {pendingReport ? (
              <View style={[styles.attachmentRow, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
                <Text style={[styles.attachmentText, { color: palette.text }]} numberOfLines={1}>
                  Attached: {pendingReport.name}
                </Text>
                <Pressable onPress={() => setPendingReport(null)}>
                  <Text style={[styles.attachmentRemove, { color: palette.subText }]}>Remove</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={[styles.composerTopRow, isCompact && styles.composerTopRowCompact]}>
              <Pressable style={[styles.iconBtn, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={handleUpload}><Text style={[styles.iconBtnText, { color: palette.text }]}>📎</Text></Pressable>
              <Pressable style={[styles.iconBtn, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={handleMicInput}><Text style={[styles.iconBtnText, { color: isListening ? '#ff7f9b' : palette.text }]}>🎤</Text></Pressable>
              <Pressable style={[styles.iconBtn, { backgroundColor: speakEnabled ? palette.accent : palette.cardBg, borderColor: palette.border }]} onPress={handleSpeakerToggle}><Text style={[styles.iconBtnText, { color: speakEnabled ? palette.accentText : palette.text }]}>🔊</Text></Pressable>
              <Pressable style={[styles.langCustomBtn, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={() => setLanguageMenuOpen(true)}>
                <Text style={[styles.langCustomBtnText, { color: palette.text }]}>
                  {LANG_OPTIONS.find((item) => item.value === lang)?.label || 'Auto'}
                </Text>
                <Text style={[styles.langArrow, { color: palette.subText }]}>▼</Text>
              </Pressable>
            </View>
            <View style={styles.composerBottomRow}>
              <TextInput
                ref={messageInputRef}
                style={[styles.msgInput, { backgroundColor: palette.cardBg, borderColor: palette.border, color: palette.text }]}
                placeholder="Send a message..."
                placeholderTextColor={palette.subText}
                value={messageInput}
                onChangeText={handleMessageInputChange}
              />
              <Pressable style={[styles.sendBtn, { backgroundColor: palette.accent }]} onPress={() => handleSend()} disabled={chatPending}>
                {chatPending ? <ActivityIndicator color="#fff" /> : <Text style={[styles.sendText, { color: palette.accentText }]}>Send</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={isCompact && historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setHistoryOpen(false)}>
          <Pressable style={styles.drawerPanel} onPress={(e) => e.stopPropagation()}>
            {historyList}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={languageMenuOpen} transparent animationType="fade" onRequestClose={() => setLanguageMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setLanguageMenuOpen(false)}>
          <Pressable style={[styles.langMenuCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={(e) => e.stopPropagation()}>
            {LANG_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.langMenuItem,
                  { borderColor: palette.border },
                  lang === option.value && { backgroundColor: palette.accent },
                ]}
                onPress={() => {
                  setLang(option.value);
                  setLanguageMenuOpen(false);
                }}
              >
                <Text style={{ color: lang === option.value ? palette.accentText : palette.text, fontWeight: '700' }}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.menuCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.menuEmail, { color: palette.text }]} numberOfLines={1}>{user.email}</Text>
            <Pressable style={[styles.menuItem, { borderColor: palette.border }]} onPress={() => { setMenuOpen(false); setSettingsOpen(true); }}>
              <Text style={[styles.menuItemText, { color: palette.text }]}>Settings</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: palette.border }]} onPress={openProfile}>
              <Text style={[styles.menuItemText, { color: palette.text }]}>Profile</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: palette.border }]} onPress={handleLogout}>
              <Text style={[styles.menuItemText, { color: palette.text }]}>Logout</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.profileOverlay} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[styles.profileCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.profileTitle, { color: palette.text }]}>Theme Settings</Text>
            <View style={styles.themeRow}>
              {['default', 'light', 'dark'].map((option) => (
                <View key={option} style={[styles.themeCard, { borderColor: theme === option ? palette.accent : palette.border }]}>
                  <View style={styles.themeBars}>
                    <View style={styles.themeBar} />
                    <View style={[styles.themeBar, { backgroundColor: '#2f84ff' }]} />
                    <View style={[styles.themeBar, { backgroundColor: option === 'light' ? '#f0f3fb' : '#121a2f' }]} />
                  </View>
                  <Text style={[styles.themeLabel, { color: palette.text }]}>{option === 'default' ? 'Default Theme' : option === 'light' ? 'Light Theme' : 'Dark Theme'}</Text>
                  <Pressable style={[styles.themeBtn, { backgroundColor: theme === option ? palette.cardBg : palette.accent }]} onPress={() => selectTheme(option)}>
                    <Text style={[styles.themeBtnText, { color: theme === option ? palette.subText : palette.accentText }]}>{theme === option ? 'Selected' : 'Select'}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={styles.profileActions}>
              <Pressable style={[styles.smallGhost, { borderColor: palette.border, backgroundColor: palette.cardBg }]} onPress={() => setSettingsOpen(false)}>
                <Text style={[styles.smallGhostText, { color: palette.text }]}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <Pressable style={styles.profileOverlay} onPress={() => setProfileOpen(false)}>
          <Pressable style={[styles.profileCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.profileTitle, { color: palette.text }]}>User Profile</Text>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Username</Text>
            <TextInput style={[styles.authInput, { backgroundColor: palette.panelBg, borderColor: palette.border, color: palette.text }]} value={profile.username} onChangeText={(v) => setProfile((p) => ({ ...p, username: v }))} placeholder="Username" placeholderTextColor={palette.subText} />
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Email</Text>
            <TextInput style={[styles.authInput, { backgroundColor: palette.panelBg, borderColor: palette.border, color: palette.text }]} value={profile.email} onChangeText={(v) => setProfile((p) => ({ ...p, email: v }))} placeholder="Email" placeholderTextColor={palette.subText} />
            <Text style={[styles.fieldLabel, { color: palette.text }]}>DOB</Text>
            <Pressable style={[styles.dateField, { backgroundColor: palette.panelBg, borderColor: palette.border }]} onPress={() => setDobPickerOpen(true)}>
              <Text style={[styles.dateText, { color: palette.text }]}>{profile.dob || 'Select date'}</Text>
              <Text style={[styles.dateIcon, { color: palette.subText }]}>📅</Text>
            </Pressable>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>Gender</Text>
            <View style={[styles.genderWrap, { backgroundColor: palette.panelBg, borderColor: palette.border }]}>
              <Picker
                selectedValue={profile.gender || 'prefer_not_to_say'}
                onValueChange={(value) => setProfile((p) => ({ ...p, gender: value }))}
                style={[styles.genderPicker, { color: palette.text }]}
                dropdownIconColor={palette.text}
              >
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
                <Picker.Item label="Other" value="other" />
                <Picker.Item label="Prefer not to say" value="prefer_not_to_say" />
              </Picker>
            </View>
            {profileError ? <Text style={styles.err}>{profileError}</Text> : null}
            <View style={styles.profileActions}>
              <Pressable style={[styles.smallGhost, { borderColor: palette.border, backgroundColor: palette.cardBg }]} onPress={() => setProfileOpen(false)}><Text style={[styles.smallGhostText, { color: palette.text }]}>Cancel</Text></Pressable>
              <Pressable style={[styles.smallBlue, { backgroundColor: palette.accent }]} onPress={saveProfile}><Text style={[styles.smallBlueText, { color: palette.accentText }]}>Save</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {dobPickerOpen ? (
        <DateTimePicker
          value={dobDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            if (Platform.OS !== 'ios') setDobPickerOpen(false);
            if (selectedDate) {
              setDobDate(selectedDate);
              setProfile((prev) => ({ ...prev, dob: formatDateISO(selectedDate) }));
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loaderRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1f4f' },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, maxWidth: '84%' },
  logoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#133f80', alignItems: 'center', justifyContent: 'center' },
  logoPlus: { color: '#3ec8ff', fontSize: 28, lineHeight: 30 },
  logoTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  logoTitleSmall: { fontSize: 16 },
  logoSub: { color: '#d0ddf4', fontSize: 12 },
  logoSubSmall: { fontSize: 11 },

  landingRoot: { flex: 1, backgroundColor: '#0d1f4f' },
  navbar: { paddingHorizontal: 14, paddingTop: 26, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#334e87', gap: 10 },
  navScroll: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#3b578f', backgroundColor: '#1b2e62' },
  navTabActive: { backgroundColor: '#2ec1ff', borderColor: '#6cdcff' },
  navTabText: { color: '#d9e6ff', fontWeight: '700' },
  navTabTextActive: { color: '#123d66' },
  navAction: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#3b578f', backgroundColor: '#1b2e62' },
  navActionText: { color: '#d9e6ff', fontWeight: '700' },
  navActionPrimary: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#fff' },
  navActionPrimaryText: { color: '#214e82', fontWeight: '800' },
  landingBody: { padding: 14, gap: 14, paddingBottom: 28 },

  heroCard: { borderRadius: 22, padding: 16, backgroundColor: '#1d3f97', gap: 14 },
  heroLeft: { gap: 10 },
  heroBadge: { color: '#99d8ff', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#f4f8ff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroDesc: { color: '#d9e6ff', fontSize: 16, lineHeight: 24 },
  heroBtnRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  heroPrimary: { backgroundColor: '#2ec1ff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  heroPrimaryText: { color: '#0f3f68', fontWeight: '800' },
  heroSecondary: { borderWidth: 1, borderColor: '#95b6e7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  heroSecondaryText: { color: '#dbe9ff', fontWeight: '700' },
  heroRight: { borderWidth: 1, borderColor: '#496cb0', borderRadius: 14, padding: 14, backgroundColor: '#1a3278' },
  panelTitle: { color: '#e5efff', fontWeight: '800', marginBottom: 8 },
  panelText: { color: '#c4d8ff', fontSize: 15, lineHeight: 22 },

  sectionWrap: { gap: 12 },
  sectionSpacer: { height: 26 },
  sectionTitle: { color: '#f4f8ff', fontSize: 30, fontWeight: '800' },
  sectionIntro: { color: '#c9dbff', fontSize: 16, lineHeight: 24 },
  infoCard: { borderRadius: 14, borderWidth: 1, borderColor: '#7ea5ea', backgroundColor: '#234aa2', padding: 14 },
  infoCardText: { color: '#ecf4ff', fontSize: 15, lineHeight: 23 },
  gridTwo: { gap: 10 },
  featureBox: { borderRadius: 14, borderWidth: 1, borderColor: '#4f72b8', backgroundColor: '#122d73', padding: 14 },
  featureHead: { color: '#eff5ff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  featureBody: { color: '#c4d8ff', fontSize: 15, lineHeight: 22 },

  authRoot: { flex: 1, backgroundColor: '#0a1b48' },
  authKeyboardWrap: { flex: 1 },
  authScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 18 },
  authPanel: { borderRadius: 16, padding: 16, backgroundColor: '#102760', borderWidth: 1, borderColor: '#355792' },
  backGhost: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#5e7cb0', marginBottom: 10 },
  backGhostText: { color: '#dbe8ff', fontWeight: '600' },
  authTitle: { color: '#f3f8ff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  authSub: { color: '#cedfff', marginTop: 8, marginBottom: 14, fontSize: 15, lineHeight: 22 },
  authInput: { borderWidth: 1, borderColor: '#476298', backgroundColor: '#243665', color: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 16 },
  authBtn: { backgroundColor: '#2ec1ff', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  authBtnText: { color: '#123f66', fontSize: 16, fontWeight: '800' },
  switchText: { marginTop: 12, color: '#c7d8f5', fontSize: 14 },
  switchLink: { color: '#81ddff', fontWeight: '700' },

  chatRoot: { flex: 1, backgroundColor: '#13234f' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#3c5588', backgroundColor: '#1a2f66' },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  hamBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#607cb1', backgroundColor: '#304879' },
  hamText: { color: '#fff', fontSize: 20 },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2e7dff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },

  chatBody: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 260, backgroundColor: '#10234f', borderRightWidth: 1, borderRightColor: '#314f84', padding: 12 },
  newChat: { backgroundColor: '#2ec1ff', borderRadius: 12, alignItems: 'center', paddingVertical: 12, marginBottom: 10 },
  newChatText: { color: '#0f3f68', fontWeight: '800' },
  convItem: { backgroundColor: '#152b60', borderRadius: 12, borderWidth: 1, borderColor: '#3d5a95', padding: 10, marginBottom: 8, gap: 6 },
  convItemActive: { borderColor: '#66e0ff' },
  convText: { color: '#ecf3ff' },
  convDelete: { color: '#ff9fb4', fontSize: 12, fontWeight: '700' },

  chatMain: { flex: 1, padding: 12, paddingBottom: 4 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 22 },
  emptyTitle: { color: '#f3f8ff', fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptySub: { color: '#d3e3ff', textAlign: 'center', marginBottom: 16, fontSize: 14, lineHeight: 21 },
  suggestCard: { width: '100%', borderWidth: 1, borderColor: '#3d5a95', borderRadius: 14, backgroundColor: '#1f356c', padding: 12, marginBottom: 6 },
  suggestText: { color: '#edf4ff', fontSize: 16 },

  msgList: { paddingBottom: 10 },
  msgPair: { marginBottom: 10 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 6 },
  bubble: { borderRadius: 12, padding: 10, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2ec1ff' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#1f356c', borderWidth: 1, borderColor: '#3d5a95' },
  userText: { color: '#0f3f68', fontSize: 16 },
  botText: { color: '#e7f0ff', fontSize: 16 },
  editLink: { color: '#8adfff', fontSize: 13, fontWeight: '700' },
  editWrap: { gap: 8, marginBottom: 8 },
  editInput: { borderWidth: 1, borderColor: '#476298', backgroundColor: '#243665', color: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },

  composer: { borderWidth: 1, borderColor: '#3d5a95', backgroundColor: '#1a2f66', borderRadius: 14, padding: 8, gap: 8 },
  composerLifted: { marginBottom: 12 },
  attachmentRow: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  attachmentText: { flex: 1, fontSize: 14, fontWeight: '600' },
  attachmentRemove: { fontSize: 13, fontWeight: '700' },
  composerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerTopRowCompact: { justifyContent: 'flex-start' },
  composerBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#304879', borderWidth: 1, borderColor: '#607cb1', alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: '#fff', fontSize: 16 },
  langCustomBtn: { minWidth: 170, height: 40, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  langCustomBtnText: { fontSize: 15, fontWeight: '700' },
  langArrow: { fontSize: 12 },
  msgInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#476298', backgroundColor: '#243665', color: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  sendBtn: { backgroundColor: '#2ec1ff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  sendText: { color: '#123f66', fontWeight: '800' },

  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row' },
  drawerPanel: { width: 280, height: '100%', backgroundColor: '#10234f' },

  menuOverlay: { flex: 1 },
  menuCard: { position: 'absolute', top: 94, right: 12, width: 290, borderRadius: 14, borderWidth: 1, padding: 10, gap: 8 },
  menuEmail: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  menuItem: { borderWidth: 1, borderRadius: 22, alignItems: 'center', paddingVertical: 10 },
  menuItemText: { fontSize: 17, fontWeight: '600' },
  langMenuCard: { position: 'absolute', bottom: 118, right: 16, width: 190, borderRadius: 12, borderWidth: 1, padding: 8, gap: 6 },
  langMenuItem: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10 },

  profileOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  profileCard: { borderRadius: 14, padding: 14, backgroundColor: '#102760', borderWidth: 1, borderColor: '#355792' },
  profileTitle: { color: '#f3f8ff', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  profileActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  fieldLabel: { marginBottom: 6, fontWeight: '600', fontSize: 16 },
  dateField: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 15 },
  dateIcon: { fontSize: 16 },
  genderWrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  genderPicker: { height: 48 },
  themeRow: { gap: 10 },
  themeCard: { borderWidth: 1, borderRadius: 12, padding: 10 },
  themeBars: { gap: 6, marginBottom: 8 },
  themeBar: { height: 12, borderRadius: 6, backgroundColor: '#2b3c63' },
  themeLabel: { fontWeight: '700', marginBottom: 8 },
  themeBtn: { borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  themeBtnText: { fontWeight: '700' },

  smallBlue: { backgroundColor: '#2ec1ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  smallBlueText: { color: '#123f66', fontWeight: '800' },
  smallGhost: { borderWidth: 1, borderColor: '#5e7cb0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#243665' },
  smallGhostText: { color: '#dbe8ff', fontWeight: '700' },

  err: { color: '#ff8ea8', marginBottom: 8 },
});
