import { SkillGapTabs } from "./tabs";

/* The Skill Gap Radar pack: its own pages, under one tab bar. */
export default function SkillGapLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <SkillGapTabs />
      {children}
    </div>
  );
}
