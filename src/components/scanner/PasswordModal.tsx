import React, { useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';

interface PasswordModalProps {
  currentPassword: string;
  onSavePassword: (password: string) => void;
  onClose: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  currentPassword,
  onSavePassword,
  onClose,
}) => {
  const [inputVal, setInputVal] = useState(currentPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      alert('Por favor, informe a senha da prova.');
      return;
    }
    onSavePassword(inputVal.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Senha do Gabarito Protegido</h3>
            <p className="text-xs text-slate-500">
              Necessária para decodificar o QR Code da prova e calcular as notas.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Senha Mestra da Prova
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Ex: senha123"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Esta é a mesma senha definida nas configurações do cabeçalho ao gerar a prova.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              Confirmar Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
