import { SectionHeaderElement } from '@/types/survey';
import { ElementMode } from './element-renderer';

interface Props {
  element: SectionHeaderElement;
  mode: ElementMode;
}

export function SectionHeaderRenderer({ element }: Props) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold">{element.title}</h3>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
    </div>
  );
}
