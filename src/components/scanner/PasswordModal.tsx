import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      alert('Por favor, informe a senha da prova.');
      return;
    }
    onSubmitPassword(inputVal.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Senha não encontrada neste perfil</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Não consegui abrir este QR Code com as senhas das provas deste perfil. A folha pode ser de outra prova ou de outro perfil.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Digitar senha apenas desta vez
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none"
                placeholder="Senha da prova"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
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
            <p className="text-[11px] text-slate-500 mt-1">
              Esta senha será usada apenas para ler esta folha e não será salva permanentemente.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-on-accent bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              Tentar esta senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
