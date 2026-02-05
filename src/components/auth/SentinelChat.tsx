import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { useLocale } from '../../hooks/useLocale';

interface Message {
 id: string;
 text: string;
 sender: 'user' | 'bot';
 timestamp: Date;
}

const KNOWLEDGE_BASE_KEYWORDS = {
 security: ['sécurité', 'security', 'iso', 'certification', 'hack', 'protéger'],
 pricing: ['prix', 'tarif', 'coût', 'abonnement', 'gratuit', 'plan'],
 features: ['fonctionnalité', 'feature', 'cartographie', 'risque', 'audit'],
 sovereignty: ['souveraineté', 'cloud', 'hébergement', 'secnumcloud', 'français', 'donnée'],
 roi: ['roi', 'retour', 'investissement', 'gagner', 'temps', 'argent'],
 hello: ['bonjour', 'salut', 'coucou', 'hello', 'hi']
};

type ResponseKey = 'security' | 'pricing' | 'features' | 'sovereignty' | 'roi' | 'hello' | 'default';

const SentinelChat: React.FC = () => {
 const { t } = useLocale();
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [isTyping, setIsTyping] = useState(false);
 const chatContainerRef = useRef<HTMLDivElement>(null);
 const [initialized, setInitialized] = useState(false);

 // Initialize first message with translation
 useEffect(() => {
 if (!initialized) {
 setMessages([
 {
  id: '1',
  text: t('auth.chat.greeting', { defaultValue: 'Bonjour ! Je suis Sentinel, votre expert GRC personnel. Posez-moi une question sur la plateforme, la securite ou la conformite.' }),
  sender: 'bot',
  timestamp: new Date()
 }
 ]);
 setInitialized(true);
 }
 }, [initialized, t]);

 const scrollToBottom = () => {
 if (chatContainerRef.current) {
 chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
 }
 };

 useEffect(() => {
 scrollToBottom();
 }, [messages, isTyping]);

 const getResponseText = (key: ResponseKey): string => {
 const responses: Record<ResponseKey, string> = {
 security: t('auth.chat.response.security', { defaultValue: "La securite est notre ADN. Sentinel est construit selon les standards **ISO 27001**, chiffre de bout en bout et audite regulierement. Vos donnees sont plus en securite ici que dans un coffre-fort." }),
 pricing: t('auth.chat.response.pricing', { defaultValue: "Nous proposons des plans adaptes a chaque maturite : **Start** pour demarrer, **Pro** pour structurer, et **Enterprise** pour passer a l'echelle. Vous pouvez commencer gratuitement des maintenant." }),
 features: t('auth.chat.response.features', { defaultValue: "Sentinel centralise tout : **Cartographie des actifs**, gestion dynamique des **risques**, suivi de **conformite (ISO, RGPD)** et generation de **rapports d'audit** en un clic. C'est votre cockpit de pilotage." }),
 sovereignty: t('auth.chat.response.sovereignty', { defaultValue: "Vos donnees sont hebergees en France sur des infrastructures qualifiees **SecNumCloud**. Nous garantissons une souverainete numerique totale, sans compromis." }),
 roi: t('auth.chat.response.roi', { defaultValue: "Nos clients reduisent de **40% le temps de preparation aux audits** et de **60% le temps de gestion administrative**. Sentinel transforme la conformite de centre de cout en avantage competitif." }),
 hello: t('auth.chat.response.hello', { defaultValue: "Bonjour ! Je suis l'IA Sentinel. Je suis la pour repondre a toutes vos questions sur la gouvernance, la securite ou notre plateforme. Comment puis-je vous aider ?" }),
 default: t('auth.chat.response.default', { defaultValue: "Je suis une IA specialisee en gouvernance cyber. Je peux vous parler de **Securite**, de **Souverainete des donnees**, ou du **ROI** de notre solution. Que souhaitez-vous savoir ?" })
 };
 return responses[key];
 };

 const findResponse = (text: string): string => {
 const lowerText = text.toLowerCase();
 for (const [key, keywords] of Object.entries(KNOWLEDGE_BASE_KEYWORDS)) {
 if (keywords.some(k => lowerText.includes(k))) {
 return getResponseText(key as ResponseKey);
 }
 }
 return getResponseText('default');
 };

 const [messageCount, setMessageCount] = useState(0);
 const MAX_MESSAGES = 5;

 const handleSend = async (e?: React.FormEvent) => {
 e?.preventDefault();
 if (!input.trim() || messageCount >= MAX_MESSAGES) return;

 const userMsg: Message = {
 id: Date.now().toString(),
 text: input,
 sender: 'user',
 timestamp: new Date()
 };

 setMessages(prev => [...prev, userMsg]);
 setInput('');
 setIsTyping(true);
 setMessageCount(prev => prev + 1);

 // Simulate AI thinking time
 setTimeout(() => {
 const responseText = findResponse(userMsg.text);
 const botMsg: Message = {
 id: (Date.now() + 1).toString(),
 text: responseText,
 sender: 'bot',
 timestamp: new Date()
 };
 setMessages(prev => [...prev, botMsg]);
 setIsTyping(false);
 }, 1200);
 };

 const handleSuggestionClick = (suggestion: string) => {
 if (messageCount >= MAX_MESSAGES) return;
 setInput(suggestion);
 // Optional: auto-send
 // handleSend();
 };

 return (
 <div className="flex flex-col h-full relative z-20">
 {/* Chat Area */}
 <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar">
 {messages.map((msg) => (
  <div
  key={msg.id || 'unknown'}
  className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
  >
  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-primary' : 'bg-primary'}`}>
  {msg.sender === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
  </div>
  <div
  className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
  ? 'bg-primary text-white rounded-tr-none'
  : 'bg-background/80 backdrop-blur-md text-foreground rounded-tl-none border border-muted'
  }`}
  >
  <Markdown
  components={{
   p: ({ ...props }) => <p {...props} className="mb-0" />,
   strong: ({ ...props }) => <span {...props} className="font-bold text-primary" />
  }}
  >
  {msg.text}
  </Markdown>
  </div>
  </div>
 ))}

 {isTyping && (
  <div className="flex gap-3">
  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
  <Bot size={16} className="text-white" />
  </div>
  <div className="bg-background/80 backdrop-blur-md p-3 rounded-2xl rounded-tl-none border border-muted">
  <div className="flex space-x-1">
  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
  </div>
  </div>
 )}

 {/* Limit reached warning */}
 {messageCount >= MAX_MESSAGES && (
  <div className="flex justify-center my-4 animate-fade-in">
  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 max-w-[90%] text-center">
  <p className="text-xs font-bold text-warning">
  {t('auth.chat.limitReached', { defaultValue: 'Limite de questions atteinte pour cette session.' })}
  </p>
  <p className="text-[11px] text-warning/80 mt-1">
  {t('auth.chat.loginToContinue', { defaultValue: 'Connectez-vous ou creez un compte pour continuer a echanger avec Sentinel.' })}
  </p>
  </div>
  </div>
 )}
 </div>

 {/* Suggestions (only if few messages) */}
 {messages.length < 3 && !isTyping && messageCount < MAX_MESSAGES && (
 <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
  <button onClick={() => handleSuggestionClick(t('auth.chat.suggestion.security', { defaultValue: 'Parlez-moi de la securite' }))} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-muted/30 hover:bg-primary/10 border border-primary/20 text-xs font-medium text-primary transition-colors flex items-center gap-1">
  <Sparkles size={12} /> {t('auth.chat.securityLabel', { defaultValue: 'Securite' })}
  </button>
  <button onClick={() => handleSuggestionClick(t('auth.chat.suggestion.sovereignty', { defaultValue: 'Ou sont mes donnees ?' }))} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-muted/30 hover:bg-primary/10 border border-blue-200 dark:border-blue-800 dark:border-blue-800 text-xs font-medium text-primary transition-colors">
  {t('auth.chat.sovereigntyLabel', { defaultValue: 'Souverainete (Cloud)' })}
  </button>
  <button onClick={() => handleSuggestionClick(t('auth.chat.suggestion.roi', { defaultValue: 'Quel est le ROI ?' }))} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-muted/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-success transition-colors">
  {t('auth.chat.roiLabel', { defaultValue: 'ROI & Couts' })}
  </button>
 </div>
 )}

 {/* Input Area */}
 <form onSubmit={handleSend} className="relative">
 <input
  type="text"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder={messageCount >= MAX_MESSAGES ? t('auth.chat.limitReachedShort', { defaultValue: 'Limite atteinte' }) : t('auth.chat.placeholder', { defaultValue: 'Posez votre question...' })}
  disabled={messageCount >= MAX_MESSAGES}
  className="w-full bg-background/70 backdrop-blur-sm dark:text-white border border-muted rounded-3xl py-3 pl-4 pr-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 placeholder-slate-500 dark:placeholder-slate-400 shadow-inner disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600"
 />
 <button
  type="submit"
  disabled={!input.trim() || isTyping || messageCount >= MAX_MESSAGES}
  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-primary hover:bg-primary/80 text-white rounded-lg disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600 transition-colors shadow-md"
 >
  <Send size={16} />
 </button>
 </form>
 </div>
 );
};

export default SentinelChat;
