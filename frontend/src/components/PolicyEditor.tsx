// 🛠️ Policy Editor - CASL-aware permission management
import { AppAbility, AppAction, AppSubject } from "@casl-poc/shared";

interface PolicyEditorProps {
  ability: AppAbility;
  appSchema: Record<string, any>;
  onTogglePermission: (subject: string, action: string) => void;
  userRules: any[];
  show: boolean;
  onToggle: () => void;
}

export function PolicyEditor({ 
  ability, 
  appSchema, 
  onTogglePermission, 
  userRules, 
  show, 
  onToggle 
}: PolicyEditorProps) {
  if (!show) return null;

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">📋 Edit Permissions</h2>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {Object.entries(appSchema).map(([subject, config]: [string, any]) => (
        <div key={subject} className="mb-6">
          <h3 className="font-medium text-lg mb-3 text-gray-700">{subject} Permissions:</h3>
          <div className="grid grid-cols-3 gap-4">
            {config.actions.map((action: string) => {
              // 🔒 CASL Power: Use ability to check current permissions
              const hasPermission = ability.can(action as AppAction, subject as AppSubject);
              const permission = config.permissions.find(
                (p: any) => p.action === action
              );

              return (
                <label
                  key={action}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={hasPermission}
                    onChange={() => onTogglePermission(subject, action)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="capitalize font-medium">{action}</span>
                    {permission?.conditions && (
                      <span className="text-xs text-gray-500 block">
                        (with conditions)
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-sm mb-2">Current Rules JSON:</h4>
        <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
          {JSON.stringify(userRules, null, 2)}
        </pre>
      </div>
    </div>
  );
}