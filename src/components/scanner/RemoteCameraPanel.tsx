import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
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
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CountUp } from '../ui/CountUp';

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

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Usar Câmera do Celular"
      description="A foto sai da câmera do celular e chega direto ao computador."
      size="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Estado: Sem Sessão Ativa */}
        {!session && !isStarting && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Radio className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-body font-bold text-slate-800">
                Pronto para conectar seu aparelho
              </h3>
              <p className="text-meta text-slate-500 max-w-sm mx-auto leading-relaxed">
                Ao iniciar, o GabariTeX abrirá uma conexão local segura na sua rede Wi-Fi. Você poderá escanear o QR Code pelo aplicativo de câmera nativo do celular (sem instalar nada).
              </p>
            </div>

            {availableInterfaces.length > 1 && (
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-meta space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Interface de Rede Local (IP):
                </label>
                <select
                  value={selectedIp}
                  onChange={(e) => setSelectedIp(e.target.value)}
                  className="w-full text-meta px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {availableInterfaces.map((iface) => (
                    <option key={iface.ip} value={iface.ip}>
                      {iface.ip} ({iface.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={() => onStart(selectedIp || undefined)}
              icon={<Smartphone className="w-4 h-4" />}
              className="w-full justify-center"
            >
              Iniciar Câmera do Celular
            </Button>
          </div>
        )}

        {/* Estado: Iniciando */}
        {isStarting && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-meta font-semibold text-slate-600">
              Iniciando servidor local e gerando chave de pareamento...
            </p>
          </div>
        )}

        {/* Estado: Sessão Ativa */}
        {session && (
          <div className="space-y-4">
            {/* Bloco do QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-card border border-slate-200 text-center">
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
              <span className="text-body font-bold text-slate-800">
                Aponte o app de câmera do celular para este código
              </span>
              <span className="text-meta text-slate-500 mt-0.5">
                O link abrirá uma página leve no navegador para enviar as fotos.
              </span>
            </div>

            {/* URL e Cópia */}
            <div className="space-y-1 text-meta">
              <label className="font-semibold text-slate-700 block">
                Ou acesse o endereço no celular:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={session.url}
                  className="w-full text-meta font-mono px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 select-all focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyUrl}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>

            {/* Seletor de Interface (se houver mais de uma) */}
            {session.interfaces.length > 1 && (
              <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-meta">
                <span className="text-slate-600 font-medium">Trocar IP da rede:</span>
                <select
                  value={selectedIp}
                  onChange={(e) => handleIpChange(e.target.value)}
                  className="text-meta px-2 py-1 rounded border border-slate-300 bg-white font-medium"
                >
                  {session.interfaces.map((iface) => (
                    <option key={iface.ip} value={iface.ip}>
                      {iface.ip} ({iface.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status e Contadores com CountUp */}
            <div className="flex items-center justify-between p-3 rounded-card bg-emerald-50 border border-emerald-200 text-meta">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-emerald-900">
                  Aguardando fotos do celular
                </span>
              </div>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300 tabular-nums">
                <CountUp value={receivedCount} /> {receivedCount === 1 ? 'foto recebida' : 'fotos recebidas'}
              </span>
            </div>

            {/* Botão de Desconexão */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="danger"
                size="sm"
                onClick={onStop}
                icon={<PowerOff className="w-3.5 h-3.5" />}
              >
                Parar Câmera
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
              >
                Continuar na Fila
              </Button>
            </div>
          </div>
        )}

        {/* Seção de Ajuda "Não Conecta?" */}
        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="w-full flex items-center justify-between text-meta font-semibold text-slate-600 hover:text-slate-800 transition py-1"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Não está conseguindo conectar?
            </span>
            {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHelp && (
            <div className="mt-2.5 p-3.5 rounded-card bg-slate-50 border border-slate-200 text-meta text-slate-600 space-y-2 leading-relaxed">
              <p>
                <strong>1. Mesma rede Wi-Fi:</strong> Certifique-se de que o celular e este computador estejam conectados à mesma rede local.
              </p>
              <p>
                <strong>2. Redes escolares ou de visitantes:</strong> Muitas redes institucionais ativam <em>isolamento de clientes</em> (os aparelhos não conseguem conversar entre si). Nesse caso, ative o <strong>Roteador Wi-Fi (hotspot) do celular</strong> e conecte o computador nele.
              </p>
              <p>
                <strong>3. Firewall do sistema:</strong> Se a porta estiver bloqueada no computador:
                <br />
                <code className="inline-block mt-1 p-1 bg-white border border-slate-200 rounded font-mono text-meta text-slate-800">
                  sudo ufw allow 47831/tcp
                </code>{' '}
                (Ubuntu/Debian)
                <br />
                <code className="inline-block mt-0.5 p-1 bg-white border border-slate-200 rounded font-mono text-meta text-slate-800">
                  sudo firewall-cmd --add-port=47831/tcp
                </code>{' '}
                (Fedora)
              </p>
              <div className="flex items-start gap-1.5 pt-1 text-meta text-amber-800">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Aviso: use apenas em redes locais de sua confiança. O tráfego local não é criptografado.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
