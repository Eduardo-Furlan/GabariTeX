import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Button } from '../src/components/ui/Button';
import { IconButton } from '../src/components/ui/IconButton';
import { Surface } from '../src/components/ui/Surface';
import { Badge } from '../src/components/ui/Badge';
import { Field, Input, Textarea, Select } from '../src/components/ui/Field';
import { Segmented } from '../src/components/ui/Segmented';
import { Modal } from '../src/components/ui/Modal';
import { Popover } from '../src/components/ui/Popover';
import { ToastHost } from '../src/components/ui/Toast';
import { ConfirmHost } from '../src/components/ui/ConfirmHost';
import { Alert } from '../src/components/ui/Alert';
import { Bubble } from '../src/components/ui/Bubble';
import { BubbleLoader } from '../src/components/ui/BubbleLoader';
import { CountUp } from '../src/components/ui/CountUp';
import { ScoreRing } from '../src/components/ui/ScoreRing';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { Skeleton } from '../src/components/ui/Skeleton';
import { ScreenSkeleton } from '../src/components/ui/ScreenSkeleton';
import { EmptyState } from '../src/components/ui/EmptyState';

describe('UI Primitives SSR and Contract Guard', () => {
  it('renders all primitives via SSR without throwing', () => {
    expect(() => {
      renderToString(
        <div>
          <Button variant="primary">Test Button</Button>
          <IconButton label="Test Action" />
          <Surface tone="raised">Content</Surface>
          <Badge tone="ok" dot>Status</Badge>
          <Field label="Label" hint="Hint" error="Error">
            <Input defaultValue="val" />
          </Field>
          <Textarea defaultValue="text" />
          <Select defaultValue="a">
            <option value="a">A</option>
          </Select>
          <Segmented
            options={[{ value: 'opt1', label: 'Opt 1' }, { value: 'opt2', label: 'Opt 2' }]}
            value="opt1"
            onChange={() => {}}
          />
          <Modal open={false} onOpenChange={() => {}} title="Closed Modal">
            Hidden
          </Modal>
          <Popover open={false} onOpenChange={() => {}}>
            Hidden Popover
          </Popover>
          <ToastHost />
          <ConfirmHost />
          <Alert tone="warn" title="Warning">Alert content</Alert>
          <Bubble state="filled">A</Bubble>
          <BubbleLoader />
          <CountUp value={42} />
          <ScoreRing percent={85}>85%</ScoreRing>
          <ProgressBar value={50} />
          <Skeleton className="h-4 w-20" />
          <ScreenSkeleton />
          <EmptyState title="Vazio" description="Sem itens" />
        </div>
      );
    }).not.toThrow();
  });

  it('renders no dialog markup when Modal is closed', () => {
    const html = renderToString(
      <Modal open={false} onOpenChange={() => {}} title="Closed Dialog Title">
        Modal Content
      </Modal>
    );
    expect(html).not.toContain('Closed Dialog Title');
    expect(html).not.toContain('role="dialog"');
  });

  it('ensures Button has type="button" by default', () => {
    const html = renderToString(<Button>Click me</Button>);
    expect(html).toContain('type="button"');
  });

  it('ensures IconButton requires and renders aria-label', () => {
    const html = renderToString(<IconButton label="Adicionar Item" />);
    expect(html).toContain('aria-label="Adicionar Item"');
    expect(html).toContain('title="Adicionar Item"');
  });

  it('ensures CountUp SSR output contains the final number', () => {
    const html = renderToString(<CountUp value={99} />);
    expect(html).toContain('99');
    expect(html).toContain('data-value="99"');
  });

  it('ensures ToastHost renders a live region', () => {
    const html = renderToString(<ToastHost />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('ensures Segmented marks exactly one aria-checked="true"', () => {
    const html = renderToString(
      <Segmented
        options={['A', 'B', 'C']}
        value="B"
        onChange={() => {}}
      />
    );
    const checkedCount = (html.match(/aria-checked="true"/g) || []).length;
    expect(checkedCount).toBe(1);
  });
});
