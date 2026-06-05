"use client";

type BGEmptyStateProps = {
  title: string;
  description?: string;
};

export default function BGEmptyState({ title, description }: BGEmptyStateProps) {
  return (
    <div className="bg-empty bg-empty-state">
      <div className="bg-empty-title">{title}</div>
      {description && <div className="bg-empty-description">{description}</div>}
    </div>
  );
}
