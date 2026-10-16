import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Smartphone,
  X,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Radio,
  PowerOff,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { RemoteSessionInfo, NetworkInterfaceInfo } from '../../platform/remoteCamera';

interface RemoteCameraPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: RemoteSessionInfo | null;
  isStarting: boolean;
  receivedCount: number;
  availableInterfaces: NetworkInterfaceInfo[];
  onStart: (ip?: string) => Promise<void>;
  onStop: () => Promise<void>;
  onChangeInterface: (ip: string) => Promise<void>;
}

export const RemoteCameraPanel: React.FC<RemoteCameraPanelProps> = ({
  isOpen,
  onClose,
  session,
  isStarting,
  receivedCount,
  availableInterfaces,
  onStart,
  onStop,
  onChangeInterface,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [selectedIp, setSelectedIp] = useState<string>('');

  useEffect(() => {
    if (session?.url) {
      QRCode.toDataURL(session.url, {
        width: 240,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.warn('[RemoteCameraPanel] Erro ao gerar QR Code:', err);
          setQrDataUrl(null);
        });
      setSelectedIp(session.ip);
    } else {
      setQrDataUrl(null);
      if (availableInterfaces.length > 0 && !selectedIp) {
        setSelectedIp(availableInterfaces[0].ip);
      }
    }
  }, [session, availableInterfaces]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    if (!session?.url) return;
    try {
      await navigator.clipboard.writeText(session.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleIpChange = async (newIp: string) => {
    setSelectedIp(newIp);
    if (session) {
      await onChangeInterface(newIp);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remote-camera-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 id="remote-camera-title" className="text-base font-bold text-slate-800">
                Usar Câmera do Celular
              </h2>
              <p className="text-xs text-slate-500">
                A foto sai da câmera do celular e chega direto ao computador.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Fechar (a sessão continuará ativa em segundo plano)"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado: Sem Sessão Ativa */}
        {!session && !isStarting && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Radio className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                Pronto para conectar seu aparelho
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Ao iniciar, o GabariTeX abrirá uma conexão local segura na sua rede Wi-Fi. Você poderá escanear o QR Code pelo aplicativo de câmera nativo do celular (sem instalar nada).
              </p>
            </div>

            {availableInterfaces.length > 1 && (
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Interface de Rede Local (IP):
                </label>
                <select
                  value={selectedIp}
                  onChange={(e) => setSelectedIp(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {availableInterfaces.map((iface) => (
                    <option key={iface.ip} value={iface.ip}>
                      {iface.ip} ({iface.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => onStart(selectedIp || undefined)}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-on-accent transition shadow-sm flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" /> Iniciar Câmera do Celular
            </button>
          </div>
        )}

        {/* Estado: Iniciando */}
        {isStarting && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">
              Iniciando servidor local e gerando chave de pareamento...
            </p>
          </div>
        )}

        {/* Estado: Sessão Ativa */}
        {session && (
          <div className="space-y-4">
            {/* Bloco do QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
              {qrDataUrl ? (
                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 mb-2">
                  <img
                    src={qrDataUrl}
                    alt="QR Code para conectar a câmera do celular"
                    className="w-48 h-48 block"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-200 rounded-xl mb-2">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                </div>
              )}
              <span className="text-xs font-bold text-slate-800">
                Aponte o app de câmera do celular para este código
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                O link abrirá uma página leve no navegador para enviar as fotos.
              </span>
            </div>

            {/* URL e Cópia */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700 block">
                Ou acesse o endereço no celular:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={session.url}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shrink-0 transition"
                  title="Copiar URL"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-bold text-emerald-600">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Seletor de Interface (se houver mais de uma) */}
            {session.interfaces.length > 1 && (
              <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Trocar IP da rede:</span>
                <select
                  value={selectedIp}
                  onChange={(e) => handleIpChange(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-slate-300 bg-white font-medium"
                >
                  {session.interfaces.map((iface) => (
                    <option key={iface.ip} value={iface.ip}>
                      {iface.ip} ({iface.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status e Contadores */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                  Aguardando fotos do celular
                </span>
              </div>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/30">
                {receivedCount} {receivedCount === 1 ? 'foto recebida' : 'fotos recebidas'}
              </span>
            </div>

            {/* Botão de Desconexão */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onStop}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition flex items-center gap-1.5"
              >
                <PowerOff className="w-3.5 h-3.5" /> Parar Câmera
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-on-accent transition shadow-sm"
              >
                Continuar na Fila
              </button>
            </div>
          </div>
        )}

        {/* Seção de Ajuda "Não Conecta?" */}
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-800 transition py-1"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Não está conseguindo conectar?
            </span>
            {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHelp && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                <strong>1. Mesma rede Wi-Fi:</strong> Certifique-se de que o celular e este computador estejam conectados à mesma rede local.
              </p>
              <p>
                <strong>2. Redes escolares ou de visitantes:</strong> Muitas redes institucionais ativam <em>isolamento de clientes</em> (os aparelhos não conseguem conversar entre si). Nesse caso, ative o <strong>Roteador Wi-Fi (hotspot) do celular</strong> e conecte o computador nele.
              </p>
              <p>
                <strong>3. Firewall do sistema:</strong> Se a porta estiver bloqueada no computador:
                <br />
                <code className="inline-block mt-1 p-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-800">
                  sudo ufw allow 47831/tcp
                </code>{' '}
                (Ubuntu/Debian)
                <br />
                <code className="inline-block mt-0.5 p-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-800">
                  sudo firewall-cmd --add-port=47831/tcp
                </code>{' '}
                (Fedora)
              </p>
              <div className="flex items-start gap-1.5 pt-1 text-[11px] text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Aviso: use apenas em redes locais de sua confiança. O tráfego local não é criptografado.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
