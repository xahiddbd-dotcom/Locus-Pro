
import React, { useState, useEffect } from 'react';
import { Coords, LocationStatus, AssistantMessage } from './types';
import MapComponent from './components/MapComponent';
import { geminiService } from './services/geminiService';
import { 
  Navigation, 
  Share2, 
  MapPin, 
  Users, 
  Sparkles, 
  Send, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  Volume2,
  ExternalLink,
  Footprints
} from 'lucide-react';

const App: React.FC = () => {
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [friendCoords, setFriendCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>(LocationStatus.IDLE);
  const [friendInput, setFriendInput] = useState('');
  const [insights, setInsights] = useState<string>('');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Haversine distance formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (userCoords && friendCoords) {
      const d = calculateDistance(userCoords.lat, userCoords.lng, friendCoords.lat, friendCoords.lng);
      setDistance(d);
    }
  }, [userCoords, friendCoords]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus(LocationStatus.ERROR);
      return;
    }

    setStatus(LocationStatus.TRACKING);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(newCoords);
      },
      (err) => {
        if (err.code === 1) setStatus(LocationStatus.DENIED);
        else setStatus(LocationStatus.ERROR);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (userCoords && !insights) {
      setIsLoadingInsight(true);
      geminiService.getLocationInsights(userCoords.lat, userCoords.lng)
        .then(res => setInsights(res))
        .finally(() => setIsLoadingInsight(false));
    }
  }, [userCoords, insights]);

  const handleShare = async () => {
    if (!userCoords) return;
    const shareData = {
      title: 'আমার লোকেশন - Locus Pro',
      text: `আমাকে এখানে খুঁজুন: ${userCoords.lat}, ${userCoords.lng}`,
      url: `https://www.google.com/maps?q=${userCoords.lat},${userCoords.lng}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(`${userCoords.lat}, ${userCoords.lng}`);
        alert("স্থানাঙ্ক কপি করা হয়েছে! এখন SMS বা মেসেঞ্জারে পাঠিয়ে দিন।");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFindFriend = () => {
    const parts = friendInput.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setFriendCoords({ lat: parts[0], lng: parts[1] });
    } else {
      alert("সঠিক ফরম্যাটে (Lat, Lng) কোডটি দিন।");
    }
  };

  const handleGetDirections = () => {
    if (!userCoords || !friendCoords) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${friendCoords.lat},${friendCoords.lng}&travelmode=walking`;
    window.open(url, '_blank');
  };

  const handleVoiceGuidance = async () => {
    if (!userCoords || !friendCoords || distance === null || isSpeaking) return;
    
    setIsSpeaking(true);
    const base64Audio = await geminiService.generateVoiceGuidance(
      userCoords.lat, userCoords.lng, 
      friendCoords.lat, friendCoords.lng, 
      distance
    );

    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const decodeBase64 = (base64: string) => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };

      const decodeAudio = async (data: Uint8Array, ctx: AudioContext) => {
        const dataInt16 = new Int16Array(data.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }
        return buffer;
      };

      try {
        const audioBuffer = await decodeAudio(decodeBase64(base64Audio), audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } catch (e) {
        console.error("Audio playback error", e);
        setIsSpeaking(false);
      }
    } else {
      setIsSpeaking(false);
      alert("ভয়েস গাইডেন্স তৈরি করা সম্ভব হয়নি।");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !userCoords) return;

    const userMsg: AssistantMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    const response = await geminiService.chatAboutLocation(userCoords.lat, userCoords.lng, inputMessage);
    const aiMsg: AssistantMessage = { role: 'assistant', content: response };
    setMessages(prev => [...prev, aiMsg]);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
            <Navigation className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Locus Pro
            </h1>
            <p className="text-slate-400 text-sm">স্মার্ট অফলাইন লোকেশন সার্ভিস</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === LocationStatus.TRACKING && (
            <span className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-medium animate-pulse">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              লোকেশন লাইভ
            </span>
          )}
          {status === LocationStatus.DENIED && (
            <span className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-medium">
              <AlertCircle size={14} />
              অ্যাক্সেস দেওয়া হয়নি
            </span>
          )}
        </div>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <MapComponent userCoords={userCoords} friendCoords={friendCoords} />
          
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            {distance !== null && friendCoords && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg shadow-blue-500/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <Footprints className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-tighter">বন্ধুর দূরত্ব (Walking)</p>
                    <h3 className="text-3xl font-bold text-white leading-tight">
                      {distance < 1 ? `${(distance * 1000).toFixed(0)} মিটার` : `${distance.toFixed(2)} কি.মি.`}
                    </h3>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={handleVoiceGuidance}
                    disabled={isSpeaking}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all relative overflow-hidden group"
                  >
                    {isSpeaking && <span className="absolute inset-0 bg-white/20 animate-pulse"></span>}
                    {isSpeaking ? <Loader2 className="animate-spin" size={20} /> : <Volume2 size={20} />}
                    <span className="hidden sm:inline">এআই ভয়েস গাইড</span>
                  </button>
                  <button 
                    onClick={handleGetDirections}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-4 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-black/20"
                  >
                    <ExternalLink size={20} />
                    নেভিগেশন শুরু
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
              <div className="space-y-1 text-center md:text-left">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">আপনার বর্তমান স্থানাঙ্ক</p>
                <h2 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
                   <MapPin className="text-blue-500" size={18} />
                  {userCoords ? `${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}` : 'লোডিং...'}
                </h2>
              </div>
              <button 
                onClick={handleShare}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all border border-white/10"
              >
                <Share2 size={20} />
                লোকেশন শেয়ার
              </button>
            </div>
            
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-1">এআই এলাকা পরিচিতি</h3>
                  {isLoadingInsight ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      বিশ্লেষণ চলছে...
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm leading-relaxed">{insights || "আপনার অবস্থান অনুযায়ী তথ্য লোড হচ্ছে।"}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <section className="glass-panel p-6 rounded-3xl shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-blue-400" size={20} />
              <h3 className="font-bold text-lg">বন্ধুকে খুঁজুন</h3>
            </div>
            <p className="text-slate-400 text-xs mb-4">বন্ধুর পাঠানো কোডটি নিচে দিন:</p>
            <div className="space-y-3">
              <input 
                type="text" 
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                placeholder="23.8103, 90.4125"
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white font-mono placeholder:text-slate-700 transition-all text-lg"
              />
              <button 
                onClick={handleFindFriend}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                ম্যাপে দেখুন
                <ChevronRight size={18} />
              </button>
              
              {friendCoords && (
                 <button 
                    onClick={handleGetDirections}
                    className="w-full py-4 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                 >
                   <Navigation size={18} />
                   নেভিগেট করুন
                 </button>
              )}
            </div>
          </section>

          <section className="glass-panel p-6 rounded-3xl flex flex-col h-[400px] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-indigo-400" size={20} />
                <h3 className="font-bold text-lg">স্মার্ট অ্যাসিস্ট্যান্ট</h3>
              </div>
              {!chatOpen && (
                <button 
                  onClick={() => setChatOpen(true)}
                  className="px-3 py-1 bg-white/10 rounded-lg text-xs text-blue-400 hover:bg-white/20 transition-all"
                >
                  চ্যাট করুন
                </button>
              )}
            </div>

            {!chatOpen ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <div className="p-4 bg-slate-900 rounded-full border border-white/5">
                   <MapPin className="text-slate-500 w-8 h-8" />
                </div>
                <p className="text-sm text-slate-500 px-4">এলাকার বর্ণনা বা দিকনির্দেশনা পেতে সাহায্য নিন।</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                  {messages.length === 0 && (
                    <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                      <p className="text-center text-blue-400 text-xs font-medium">আমি আপনাকে আপনার বর্তমান অবস্থান এবং গন্তব্য সম্পর্কে সাহায্য করতে পারি।</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                        m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                        : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleChatSubmit} className="relative">
                  <input 
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="জিজ্ঞেস করুন..."
                    className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-12 mb-8 text-center">
        <p className="text-slate-700 text-xs tracking-widest uppercase font-medium">
          Locus Pro • Powered by Gemini AI Intelligence
        </p>
      </footer>
    </div>
  );
};

export default App;
