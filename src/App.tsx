import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  Download, 
  X, 
  FileType,
  RefreshCw,
  FileDown,
  ShieldCheck,
  Zap,
  HelpCircle,
  Mail,
  Shield
} from 'lucide-react';
import { cn } from './lib/utils';
import { convertPdfToWord, convertWordToPdf } from './lib/converter';

type ConversionMode = 'pdf-to-word' | 'word-to-pdf';
type InfoTab = 'how-it-works' | 'privacy' | 'support' | null;

export default function App() {
  const [mode, setMode] = useState<ConversionMode>('pdf-to-word');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeInfo, setActiveInfo] = useState<InfoTab>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf');
    const isWord = selectedFile.name.endsWith('.docx') || selectedFile.name.endsWith('.doc');

    if (mode === 'pdf-to-word' && !isPdf) {
      setError('Please select a valid PDF file.');
      return;
    }
    if (mode === 'word-to-pdf' && !isWord) {
      setError('Please select a valid DOCX file.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStatus('idle');
    setResultBlob(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  }, [mode]);

  const handleConvert = async () => {
    if (!file) return;

    setStatus('processing');
    try {
      let blob: Blob;
      if (mode === 'pdf-to-word') {
        blob = await convertPdfToWord(file);
      } else {
        blob = await convertWordToPdf(file);
      }
      setResultBlob(blob);
      setStatus('completed');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Conversion failed. Please try again with a different file.');
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    const extension = mode === 'pdf-to-word' ? '.docx' : '.pdf';
    a.download = file.name.replace(/\.[^/.]+$/, "") + extension;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setResultBlob(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans text-gray-900 selection:bg-gray-200">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-white/80 backdrop-blur-md border-bottom border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <FileType className="text-white w-5 h-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ConvertFlow</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
          <button 
            onClick={() => setActiveInfo('how-it-works')}
            className="hover:text-gray-900 transition-colors cursor-pointer"
          >
            How it works
          </button>
          <button 
            onClick={() => setActiveInfo('privacy')}
            className="hover:text-gray-900 transition-colors cursor-pointer"
          >
            Privacy
          </button>
          <button 
            onClick={() => setActiveInfo('support')}
            className="hover:text-gray-900 transition-colors cursor-pointer"
          >
            Support
          </button>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-light tracking-tight mb-4"
          >
            Universal Document <span className="font-medium">Converter</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-lg sm:text-xl font-light"
          >
            Fast, secure, and processing happens entirely in your browser.
          </motion.p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center justify-center gap-2 mb-8 p-1.5 bg-gray-200/50 rounded-2xl w-fit mx-auto">
          <button
            onClick={() => { setMode('pdf-to-word'); reset(); }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              mode === 'pdf-to-word' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
            )}
          >
            PDF to Word
          </button>
          <button
            onClick={() => { setMode('word-to-pdf'); reset(); }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              mode === 'word-to-pdf' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
            )}
          >
            Word to PDF
          </button>
        </div>

        {/* Dropzone Area */}
        <motion.div
          layout
          className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center justify-center gap-6"
              >
                {!file ? (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-6 py-20 border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-gray-50/50 hover:border-gray-300 transition-all group"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Upload className="text-gray-400 w-8 h-8 group-hover:text-gray-900 transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-lg mb-1">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-400">
                        {mode === 'pdf-to-word' ? 'Supports PDF files' : 'Supports DOCX files'}
                      </p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileSelect}
                      accept={mode === 'pdf-to-word' ? '.pdf' : '.docx'}
                    />
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center gap-8 py-10">
                    <div className="flex items-center gap-4 p-6 bg-gray-50 rounded-[2rem] w-full max-w-sm">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <FileText className="text-gray-900 w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button 
                        onClick={reset}
                        className="p-2 hover:bg-white rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-gray-400">
                      <div className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {mode === 'pdf-to-word' ? 'PDF' : 'DOCX'}
                      </div>
                      <ArrowRight className="w-4 h-4" />
                      <div className="px-3 py-1 bg-gray-900 rounded-lg text-xs font-semibold uppercase tracking-wider text-white">
                        {mode === 'pdf-to-word' ? 'DOCX' : 'PDF'}
                      </div>
                    </div>

                    <button
                      onClick={handleConvert}
                      className="w-full max-w-sm py-4 bg-gray-900 text-white rounded-2xl font-medium hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-gray-200"
                    >
                      Process and Convert
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-8 py-20 text-center"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-gray-100 rounded-full" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-gray-900 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-gray-900 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-medium mb-2">Converting your file...</h3>
                  <p className="text-gray-400">Please wait while we process your document locally.</p>
                </div>
              </motion.div>
            )}

            {status === 'completed' && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center gap-8 py-20 text-center"
              >
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="text-2xl font-medium mb-2">Ready for download</h3>
                  <p className="text-gray-400 mb-8">Successfully converted {file?.name}</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-medium hover:bg-gray-800 active:scale-95 transition-all shadow-lg shadow-gray-200"
                    >
                      <Download className="w-5 h-5" />
                      Download File
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 px-8 py-4 bg-white text-gray-600 border border-gray-200 rounded-2xl font-medium hover:bg-gray-50 active:scale-95 transition-all underline decoration-gray-200 underline-offset-4"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Convert another
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-6 py-20 text-center shrink-0"
              >
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                  <X className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-medium mb-1">Something went wrong</h3>
                  <p className="text-red-500 text-sm mb-6">{error}</p>
                  <button
                    onClick={reset}
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Feature Grid */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { icon: <CheckCircle2 className="w-5 h-5" />, title: "Secure", desc: "No data ever leaves your device. Processing is 100% client-side." },
            { icon: <FileDown className="w-5 h-5" />, title: "High Fidelity", desc: "We preserve text and structure as accurately as possible." },
            { icon: <RefreshCw className="w-5 h-5" />, title: "Unlimited", desc: "Convert as many files as you want with no file size limits." }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="p-8 bg-white/50 backdrop-blur-sm rounded-3xl border border-white shadow-sm"
            >
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-900 mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="py-12 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 grayscale opacity-50">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <FileType className="text-white w-4 h-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-gray-900">ConvertFlow</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 ConvertFlow. Handcrafted for performance and privacy.</p>
        </div>
      </footer>

      {/* Info Modals */}
      <AnimatePresence>
        {activeInfo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveInfo(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 sm:p-12">
                <button 
                  onClick={() => setActiveInfo(null)}
                  className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>

                {activeInfo === 'how-it-works' && (
                  <div>
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mb-6">
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-4">How it Works</h2>
                    <div className="space-y-6">
                      {[
                        { step: "1", title: "Select Mode", desc: "Choose between PDF to Word or Word to PDF conversion depending on your needs." },
                        { step: "2", title: "Upload File", desc: "Drag and drop your document into the interface. We support standard PDF and DOCX formats." },
                        { step: "3", title: "Local Processing", desc: "Our engine processes the text and structure entirely in your browser using Web Workers." },
                        { step: "4", title: "Download", desc: "Once finished, download your converted file instantly. No servers, no waiting." }
                      ].map((item, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm">
                            {item.step}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{item.title}</h3>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeInfo === 'privacy' && (
                  <div>
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-500 mb-6">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-4">Privacy & Security</h2>
                    <p className="text-gray-500 mb-6 leading-relaxed">
                      ConvertFlow is built with a "Privacy First" philosophy. Unlike most online converters, 
                      we never upload your files to a central server.
                    </p>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl">
                        <Zap className="w-5 h-5 text-gray-900 mt-1" />
                        <div>
                          <h3 className="font-medium">Direct Processing</h3>
                          <p className="text-sm text-gray-500">Your documents are processed by your computer's RAM and CPU locally.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl">
                        <ShieldCheck className="w-5 h-5 text-gray-900 mt-1" />
                        <div>
                          <h3 className="font-medium">No Data Retention</h3>
                          <p className="text-sm text-gray-500">Since we don't have a backend storage, your data disappears when you close the tab.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeInfo === 'support' && (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-900 mx-auto mb-6">
                      <Mail className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Need Help?</h2>
                    <p className="text-gray-500 mb-8">
                      For technical support, feature requests, or bug reports, 
                      please reach out to our team at:
                    </p>
                    <div className="bg-gray-900 text-white p-6 rounded-3xl inline-block mb-4">
                      <p className="font-mono text-lg">support@convertflow.xyz</p>
                    </div>
                    <p className="text-xs text-gray-400">Response time is usually under 24 hours.</p>
                  </div>
                )}

                <button 
                  onClick={() => setActiveInfo(null)}
                  className="w-full mt-10 py-4 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-2xl font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
