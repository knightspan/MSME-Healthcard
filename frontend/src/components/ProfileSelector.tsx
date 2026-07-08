import type { MSMEProfileMeta } from "../types";

interface ProfileSelectorProps {
  profiles: MSMEProfileMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function ProfileSelector({ profiles, selectedId, onSelect, disabled }: ProfileSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {profiles.map((profile) => {
        const active = profile.id === selectedId;
        return (
          <button
            key={profile.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(profile.id)}
            className={`flex flex-col rounded-lg border p-4 text-left transition ${
              active
                ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <span className="text-sm font-semibold text-slate-900">{profile.name}</span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wide text-teal-700">
              {profile.businessType}
            </span>
            <span className="mt-2 text-xs leading-relaxed text-slate-600">{profile.shortDescription}</span>
          </button>
        );
      })}
    </div>
  );
}
