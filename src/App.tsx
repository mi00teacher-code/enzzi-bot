/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  User, 
  Bot, 
  RefreshCw, 
  Code, 
  Compass, 
  Info,
  ChevronRight,
  MessageSquare,
  Clock,
  Settings,
  Save,
  Database,
  Paperclip,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithAI, Role } from './services/geminiService';

const ENZZI_URL = "https://i.imgur.com/7am5dTg.png";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isWarning?: boolean;
  isCriticalWarning?: boolean;
  attachment?: {
    name: string;
    mimeType: string;
    previewUrl?: string; // 이미지일 때만 미리보기 썸네일 존재
  };
}

// Gemini로 전달할 첨부파일 파트 (base64 data, mimeType 프리픽스 제거된 순수 데이터)
interface AttachedFile {
  file: File;
  base64Data: string; // "data:image/png;base64,XXXX" 에서 XXXX만
  mimeType: string;
  previewUrl: string; // 이미지 미리보기용 objectURL (PDF는 빈 문자열)
}

const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_FILE_SIZE_MB = 10;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '안녕! 나는 너의 코딩 짝꿍 엔찌야. 어떤 프로그램을 만들고 싶어?',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<Role>('developer');
  const [showGuide, setShowGuide] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [timerStarted, setTimerStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [studentId, setStudentId] = useState(() => localStorage.getItem('studentId') || '학생01');
  const [appsScriptUrl, setAppsScriptUrl] = useState(() => localStorage.getItem('appsScriptUrl') || '여기에_2단계에서_복사한_URL_붙여넣기');
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // 파일(이미지/PDF) 첨부 관련 상태
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('studentId', studentId);
  }, [studentId]);

  useEffect(() => {
    localStorage.setItem('appsScriptUrl', appsScriptUrl);
  }, [appsScriptUrl]);

  // 구글 시트에 대화 저장하는 함수
  async function saveToGoogleSheets(targetStudentId: string, conversationHistory: any) {
    const APPS_SCRIPT_URL = appsScriptUrl;
    
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "여기에_2단계에서_복사한_URL_붙여넣기") {
      alert("구글 앱스 스크립트 웹 앱 URL을 먼저 설정해 주세요! (우측 상단 톱니바퀴 ⚙️ 설정 아이콘 클릭)");
      setShowSettings(true);
      return;
    }

    setSaveStatus('saving');
    try {
await fetch(APPS_SCRIPT_URL, {
  method: "POST",
  mode: "no-cors",
  // ← Content-Type 헤더 제거! no-cors에서는 사용 불가
  body: JSON.stringify({
    studentId: targetStudentId,
    messages: conversationHistory
  })
});
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("구글 시트 저장 에러:", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      alert("구글 시트 저장 중 에러가 발생했습니다. 주차된 웹 앱 URL 주소를 확인해 주세요!");
    }
  }

const handleManualSave = () => {
  const conversationHistory = messages.map((m, index) => ({
    order: index + 1,
    timestamp: m.timestamp.toLocaleString('ko-KR'),
    studentText: m.sender === 'user' ? m.text : '',
    aiText: m.sender === 'ai' ? m.text : '',
  }));
  saveToGoogleSheets(studentId, conversationHistory);
};

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerStarted && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      toggleRole();
      setTimeLeft(600); // Reset to 10 minutes
    }
    return () => clearInterval(interval);
  }, [timerStarted, timeLeft]);

  const toggleRole = () => {
    setUserRole(prev => {
      const newRole = prev === 'developer' ? 'inspector' : 'developer';
      
      const systemMsg: Message = {
        id: Date.now().toString(),
        text: `역할이 자동으로 바뀌었어! 이제 네가 ${newRole === 'developer' ? '개발자(Developer)' : '점검자(Inspector)'}야.`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prevMsgs => [...prevMsgs, systemMsg]);
      
      return newRole;
    });
  };

  const manualToggle = () => {
    setUserRole(prev => {
      const newRole = prev === 'developer' ? 'inspector' : 'developer';
      const systemMsg: Message = {
        id: Date.now().toString(),
        text: `역할이 바뀌었어! 이제 네가 ${newRole === 'developer' ? '개발자(Developer)' : '점검자(Inspector)'}야.`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prevMsgs => [...prevMsgs, systemMsg]);
      setTimeLeft(600); // Reset timer on manual toggle
      return newRole;
    });
  };

  // 파일 선택 시: 유효성 검사 후 base64로 변환해서 state에 저장
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하도록 초기화
    if (!file) return;

    setFileError(null);

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError('이미지(png/jpg/webp) 또는 PDF 파일만 업로드할 수 있어요.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하로 올려주세요.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:image/png;base64,...."
      const base64Data = result.split(',')[1] || '';
      const isImage = file.type.startsWith('image/');
      setAttachedFile({
        file,
        base64Data,
        mimeType: file.type,
        previewUrl: isImage ? result : '',
      });
    };
    reader.onerror = () => {
      setFileError('파일을 읽는 중 문제가 생겼어요. 다시 시도해줄래?');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setFileError(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    if (!timerStarted) setTimerStarted(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input || (attachedFile ? '(첨부한 화면을 봐줘!)' : ''),
      sender: 'user',
      timestamp: new Date(),
      attachment: attachedFile ? {
        name: attachedFile.file.name,
        mimeType: attachedFile.mimeType,
        previewUrl: attachedFile.previewUrl || undefined,
      } : undefined,
    };

    // 이번 턴에 보낼 파일은 로컬 변수로 미리 붙잡아두고, UI 상태는 바로 비워준다
    const filePartToSend = attachedFile
      ? { mimeType: attachedFile.mimeType, data: attachedFile.base64Data }
      : undefined;

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      // TODO(geminiService.ts): chatWithAI가 4번째 인자로 filePart({mimeType, data})를
      // 받아서 Gemini generateContent 호출 시 inlineData 파트로 함께 보내도록 수정 필요
      const aiResponse = await chatWithAI(input, history, userRole, filePartToSend);
      const isCritical = aiResponse?.includes('[CRITICAL_WARNING]');
      const isWarning = aiResponse?.includes('[WARNING]') || isCritical;
      const cleanText = aiResponse
        ?.replace('[CRITICAL_WARNING]', '')
        ?.replace('[WARNING]', '')
        ?.replace(/<br\s*\/?>/gi, '\n') // 추가된 부분: <br>, <br/>, <br /> 모두 엔터(\n)로 변환
        ?.trim() || '미안해, 잠시 생각을 못 했어. 다시 말해줄래?';
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: cleanText,
        sender: 'ai',
        timestamp: new Date(),
        isWarning: isWarning && !isCritical,
        isCriticalWarning: isCritical,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage = 'AI 친구가 잠시 생각에 빠졌어요! 1분만 기다렸다가 다시 말을 걸어줄래?';
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: errorMessage,
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen font-sans text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="playful-header px-6 py-4 flex items-center justify-between shadow-[0_4px_0_0_rgba(0,0,0,0.1)] z-10">
          <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-2xl shadow-sm overflow-hidden w-12 h-12 flex items-center justify-center">
            <img 
              src={ENZZI_URL}
              alt="Bot" 
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=bear"; }}
            />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-tight drop-shadow-sm">AI 코딩 짝꿍, 엔찌</h1>
            <p className="text-[10px] text-slate-600/80 font-bold uppercase tracking-wider">Entry Pair Programming</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {timerStarted && (
            <div className="flex items-center gap-3 bg-[#F9B2D7] border border-white/30 px-4 py-2 rounded-2xl mr-2 animate-pulse-subtle">
              <div className="relative w-8 h-8 flex items-center justify-center">
                {/* Progress Ring Background */}
                <svg className="absolute w-full h-full -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="3"
                  />
                  <motion.circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeDasharray="88"
                    animate={{ strokeDashoffset: 88 - (88 * timeLeft) / 600 }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </svg>
                <Clock className="w-4 h-4 text-white z-10" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/70 font-bold uppercase tracking-tighter leading-none mb-1">교대까지</span>
                <span className="text-sm font-black text-white tabular-nums leading-none">
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          )}
          
          {/* 구글 시트 저장 버튼 */}
          <button 
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-2xl border border-white/20 shadow-md transition-all active:scale-95"
            title="구글 시트에 대화 저장"
          >
            <Save className="w-4 h-4" />
            <span>
              {saveStatus === 'idle' && '구글 시트 저장'}
              {saveStatus === 'saving' && '저장 중...'}
              {saveStatus === 'success' && '저장 완료! ✨'}
              {saveStatus === 'error' && '저장 오류 ❌'}
            </span>
          </button>

          {/* 설정 버튼 */}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/20 text-white rounded-full transition-colors"
            title="구글 시트 연동 설정"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>

          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            title="학습 가이드"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative p-4 gap-4">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 playful-card overflow-hidden">
          {/* Role Status Bar */}
          <div className="bg-slate-50/50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all shadow-sm ${userRole === 'developer' ? 'bg-[#F9B2D7] text-white scale-105' : 'bg-slate-200 text-slate-500'}`}>
                개발자 (학생)
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all shadow-sm ${userRole === 'inspector' ? 'bg-[#F9B2D7] text-white scale-105' : 'bg-slate-200 text-slate-500'}`}>
                점검자 (엔찌)
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-widest font-black text-slate-400">
              Pair Programming
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`${msg.sender === 'user' ? 'w-10 h-10' : 'w-14 h-14'} rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm border-2 overflow-hidden ${
                      msg.sender === 'user' ? 'bg-white text-[#F9B2D7] border-[#F9B2D7]' : 'bg-white border-slate-100'
                    }`}>
                      {msg.sender === 'user' ? (
                        <User className="w-5 h-5" />
                      ) : (
                        <img 
                          src={ENZZI_URL}
                          alt="Bot" 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=bear"; }}
                        />
                      )}
                    </div>
                    <div className={`relative px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap border-2 ${
                      msg.sender === 'user' 
                        ? 'bg-[#F6FFDC] text-slate-800 border-[#E8F1C3] rounded-tr-none' 
                        : msg.isCriticalWarning
                          ? 'bg-red-100 text-red-900 border-red-400 rounded-tl-none font-bold animate-shake'
                          : msg.isWarning
                            ? 'bg-amber-100 text-amber-900 border-amber-400 rounded-tl-none font-medium'
                            : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
                    }`}>
                      {/* 첨부파일 미리보기 (사용자가 보낸 캡쳐/PDF) */}
                      {msg.attachment && (
                        <div className="mb-2">
                          {msg.attachment.previewUrl ? (
                            <img
                              src={msg.attachment.previewUrl}
                              alt={msg.attachment.name}
                              className="max-w-[220px] max-h-[220px] rounded-xl border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 max-w-[220px]">
                              <FileText className="w-5 h-5 text-red-400 flex-shrink-0" />
                              <span className="text-xs font-bold text-slate-600 truncate">{msg.attachment.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* 코드 블록 감지 및 렌더링 */}
                      {(msg.text.trim().startsWith('{') || msg.text.includes('def ') || msg.text.includes('import ')) ? (
                        <div className={`font-mono text-xs p-3 rounded-lg mb-2 overflow-x-auto ${msg.sender === 'user' ? 'bg-slate-800/10 text-slate-800' : 'bg-slate-100 text-slate-700'}`}>
                          {msg.text}
                        </div>
                      ) : (
                        msg.text.split(/(\[.*?\])/).map((part, i) => {
                          if (part.startsWith('[') && part.endsWith(']')) {
                            const blockName = part.slice(1, -1);
                            let blockClass = "entry-block";
                            
                            // 시작 (초록)
                            if (blockName.includes('클릭') || blockName.includes('신호') || blockName.includes('버튼') || blockName.includes('시작')) {
                              blockClass += " entry-block-event";
                            }
                            // 흐름 (하늘)
                            else if (blockName.includes('반복') || blockName.includes('기다리기') || blockName.includes('만약') || blockName.includes('라면') || blockName.includes('복제') || blockName.includes('중단') || blockName.includes('될 때까지')) {
                              blockClass += " entry-block-flow";
                            }
                            // 움직임 (보라)
                            else if (blockName.includes('움직') || blockName.includes('좌표') || blockName.includes('방향') || blockName.includes('회전') || blockName.includes('보기') || blockName.includes('이동') || blockName.includes('만큼')) {
                              blockClass += " entry-block-move";
                            }
                            // 생김새 (분홍)
                            else if (blockName.includes('말하기') || blockName.includes('생각하기') || blockName.includes('모양') || blockName.includes('크기') || blockName.includes('효과') || blockName.includes('숨기기') || blockName.includes('보이기') || blockName.includes('안녕')) {
                              blockClass += " entry-block-look";
                            }
                            // 소리 (연두)
                            else if (blockName.includes('소리') || blockName.includes('재생')) {
                              blockClass += " entry-block-sound";
                            }
                            // 판단 (인디고)
                            else if (blockName.includes('닿았는가') || blockName.includes('참') || blockName.includes('거짓') || blockName.includes('키') || blockName.includes('마우스') || blockName.includes('인가')) {
                              blockClass += " entry-block-judge";
                            }
                            // 계산 (노랑)
                            else if (blockName.includes('더하기') || blockName.includes('빼기') || blockName.includes('곱하기') || blockName.includes('나누기') || blockName.includes('무작위') || blockName.includes('나머지') || blockName.includes('길이') || blockName.includes('결합')) {
                              blockClass += " entry-block-calc";
                            }
                            // 자료 (자주)
                            else if (blockName.includes('변수') || blockName.includes('리스트') || blockName.includes('묻고')) {
                              blockClass += " entry-block-data";
                            }
                            
                            return <span key={i} className={blockClass}>{blockName}</span>;
                          }
                          return part;
                        })
                      )}
                      <span className={`absolute bottom-[-18px] text-[10px] text-slate-400 whitespace-nowrap ${msg.sender === 'user' ? 'right-0' : 'left-0'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center animate-pulse overflow-hidden">
                    <img 
                      src={ENZZI_URL}
                      alt="Bot" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=bear"; }}
                    />
                  </div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="p-6 bg-slate-50/30 border-t border-slate-100">
            {/* 첨부 파일 미리보기 */}
            {attachedFile && (
              <div className="mb-3 flex items-center gap-3 bg-white border-2 border-slate-200 rounded-2xl p-2 pr-3 w-fit shadow-sm">
                {attachedFile.previewUrl ? (
                  <img src={attachedFile.previewUrl} alt="첨부 이미지 미리보기" className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-400" />
                  </div>
                )}
                <span className="text-xs font-bold text-slate-600 max-w-[160px] truncate">{attachedFile.file.name}</span>
                <button
                  onClick={handleRemoveAttachment}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  title="첨부 취소"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {fileError && (
              <p className="mb-2 text-xs font-bold text-red-500">{fileError}</p>
            )}
            <div className="relative flex items-end gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="캡쳐 이미지나 PDF 첨부하기"
                className="bg-white border-2 border-slate-200 text-slate-500 p-4 rounded-[1.5rem] hover:bg-slate-50 hover:text-[#0097FF] disabled:opacity-50 transition-all shadow-sm active:scale-95 h-[52px]"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={userRole === 'developer' ? "코드를 어떻게 짤지 AI 점검자에게 물어보세요..." : "AI 개발자에게 어떤 코드를 짤지 명령하세요..."}
                rows={1}
                className="flex-1 bg-white border-2 border-slate-200 rounded-[1.5rem] px-6 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-[#0097FF]/10 focus:border-[#0097FF] transition-all placeholder:text-slate-400 shadow-sm resize-none min-h-[52px] max-h-32"
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !attachedFile) || isLoading}
                className="bg-[#0097FF] text-white p-4 rounded-[1.5rem] hover:bg-[#007ACC] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 active:scale-95 playful-button h-[52px]"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Guide */}
        <AnimatePresence>
          {showGuide && (
            <motion.aside
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 playful-card p-6 overflow-y-auto z-20"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#0097FF]" />
                  학습 가이드
                </h2>
                <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-slate-600">
                  <RefreshCw className="w-4 h-4 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">역할 설명</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-700 mb-1">개발자 (Developer)</p>
                      <p className="text-[11px] text-blue-600 leading-relaxed">직접 코딩 블록을 조립해요. 베테랑 점검자의 조언을 들어보세요!</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <p className="text-xs font-bold text-green-700 mb-1">점검자 (Inspector)</p>
                      <p className="text-[11px] text-green-600 leading-relaxed">전략을 짜고 코드를 검토해요. 베테랑 개발자에게 명령을 내려보세요!</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">학습 목표</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <div className="w-1 h-1 bg-blue-400 rounded-full" />
                      컴퓨팅 사고력 (CT) 향상
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <div className="w-1 h-1 bg-green-400 rounded-full" />
                      논리적 문제 해결력 강화
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <div className="w-1 h-1 bg-purple-400 rounded-full" />
                      창의적 아이디어 구체화
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">코드 공유하기</h3>
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        <span className="font-bold">방법 1:</span> 블록 우클릭 후 <span className="font-bold">[코드 복사하기]</span>를 눌러 채팅창에 붙여넣으세요.
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <p className="text-[11px] text-purple-700 leading-relaxed">
                        <span className="font-bold">방법 2:</span> <span className="font-bold">파이썬 모드</span>로 바꾼 뒤 텍스트 코드를 전체 복사해서 보내주세요.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">오늘의 미션 후보</h3>
                  <ul className="space-y-2">
                    {[
                      '장애물 피하기 게임 만들기',
                      '나만의 미로 탈출 게임',
                      '복제 기능을 이용한 청소기',
                      '날아가는 독수리 애니메이션',
                      '두더지 잡기 게임'
                    ].map((mission, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 group cursor-pointer hover:text-[#0097FF]">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 group-hover:bg-[#0097FF]" />
                        {mission}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="pt-4 border-t border-slate-100">
                  <div className="bg-slate-900 rounded-2xl p-4 text-white">
                    <p className="text-[10px] font-bold text-slate-400 mb-2">베테랑의 조언</p>
                    <p className="text-xs leading-relaxed">
                      "이 기능을 더 작게 쪼개볼까?" 또는 "다른 방법은 없을까?" 라고 생각해보세요. 정답보다 과정이 더 중요해요!
                    </p>
                  </div>
                </section>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status */}
      <footer className="bg-white border-t border-slate-100 px-6 py-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex items-center gap-4">
          <span>상태: 연결됨</span>
          <span>모델: Gemini 1.5 Flash</span>
        </div>
        <div>© 2026 Entry AI Pair Programming</div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-[450px] playful-card p-6 bg-white overflow-hidden shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                  <Database className="w-5 h-5 text-emerald-500" />
                  구글 스프레드시트 연동 설정
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    학번 및 이름 (Student ID)
                  </label>
                  <input 
                    type="text" 
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="예: 6학년1반23번 홍길동"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    구글 앱스 스크립트 웹 앱 URL (APPS_SCRIPT_URL)
                  </label>
                  <textarea 
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all resize-none font-mono"
                  />
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-blue-700 leading-relaxed space-y-1">
                  <p className="font-bold">💡 연동 방법:</p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>구글 스프레드시트의 <b>[확장 프로그램] &gt; [Apps Script]</b>로 들어갑니다.</li>
                    <li>설정 스크립트를 작성한 다음 <b>[배포] &gt; [새 배포]</b>를 클릭합니다.</li>
                    <li>유형을 <b>[웹 앱]</b>으로 선택하고, 액세스 권한을 <b>[모든 사용자]</b>로 설정하여 배포합니다.</li>
                    <li>배포 후 생성된 웹 앱 URL 주소를 복사해 위 입력창에 붙여넣어 주세요!</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 text-right">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95"
                >
                  닫기
                </button>
                <button 
                  onClick={() => {
                    setShowSettings(false);
                    handleManualSave();
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-100 active:scale-95"
                >
                  저장 및 동기화 💾
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
