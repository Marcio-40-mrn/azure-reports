import { AlertTriangle } from 'lucide-react'

export default function EnvCheck() {
  const org = import.meta.env.VITE_AZURE_ORG
  const pat = import.meta.env.VITE_AZURE_PAT

  if (org && pat) return null

  return (
    <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
          <h2 className="text-lg font-semibold text-gray-800">Configuração necessária</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Crie um arquivo <code className="bg-gray-100 px-1 rounded font-mono">.env</code> na raiz
          do projeto com as variáveis abaixo e{' '}
          <strong>reinicie o servidor</strong> com{' '}
          <code className="bg-gray-100 px-1 rounded font-mono">npm run dev</code>.
        </p>
        <pre className="bg-gray-50 border rounded-lg p-4 text-xs text-gray-700 mb-4 font-mono">
{`VITE_AZURE_ORG=nome-da-organizacao
VITE_AZURE_PAT=seu-personal-access-token`}
        </pre>
        <ul className="text-xs space-y-1">
          {!org && (
            <li className="text-red-500 flex items-center gap-1">
              ✗ <code>VITE_AZURE_ORG</code> não configurado
            </li>
          )}
          {!pat && (
            <li className="text-red-500 flex items-center gap-1">
              ✗ <code>VITE_AZURE_PAT</code> não configurado
            </li>
          )}
        </ul>
        <p className="text-xs text-gray-400 mt-4">
          O nome da organização é o slug que aparece na URL:{' '}
          <span className="font-mono">dev.azure.com/</span>
          <strong>nome-da-organizacao</strong>
        </p>
      </div>
    </div>
  )
}
