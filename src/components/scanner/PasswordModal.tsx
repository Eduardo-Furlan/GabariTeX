import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PasswordModalProps {
  onSubmitPassword: (password: string) => void;
  onClose: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  onSubmitPassword,
  onClose,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      setError('Por favor, informe a senha da prova.');
      return;
    }
    setError(null);
    onSubmitPassword(inputVal.trim());
    onClose();
  };

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Senha não encontrada neste perfil"
      description="Não consegui abrir este QR Code com as senhas das provas deste perfil. A folha pode ser de outra prova ou de outro perfil."
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
          >
            Tentar esta senha
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="block text-meta font-semibold text-slate-700 uppercase mb-1.5">
            Digitar senha apenas desta vez
          </label>
          <div className="relative flex items-center">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              className={`w-full pl-9 pr-10 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
              }`}
              placeholder="Senha da prova"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition p-1"
              title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && (
            <p className="text-meta text-rose-600 mt-1 font-medium" role="alert">
              {error}
            </p>
          )}
          <p className="text-meta text-slate-500 mt-1.5">
            Esta senha será usada apenas para ler esta folha e não será salva permanentemente.
          </p>
        </div>
      </form>
    </Modal>
  );
};
