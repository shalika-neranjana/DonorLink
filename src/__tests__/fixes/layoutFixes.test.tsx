import { render, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { ToastCard } from '@/components/ui/DonorLinkToast';

describe('Alerts filter row (Bug 4)', () => {
  it('keeps the scrollable filter as tall as its tabs (flexGrow 0), instead of claiming all free height', () => {
    render(
      <DonorLinkSegmentedControl
        scrollable
        value="all"
        onChange={() => undefined}
        options={['all', 'emergency', 'requests', 'donations', 'account'].map((value) => ({ value, label: value }))}
      />,
    );
    const style = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.style);
    expect(style.flexGrow).toBe(0);
  });

  it('renders every filter so none is lost when the row scrolls', () => {
    render(
      <DonorLinkSegmentedControl scrollable value="all" onChange={() => undefined} options={['all', 'emergency', 'requests', 'donations', 'account'].map((value) => ({ value, label: value }))} />,
    );
    for (const label of ['all', 'emergency', 'requests', 'donations', 'account']) expect(screen.getByText(label)).toBeTruthy();
  });
});

describe('Toast card (Bug 3)', () => {
  const widthOf = () => StyleSheet.flatten(screen.getByTestId('toast-card').props.style).width;

  it('has a definite pixel width (a percentage collapsed to a thin line inside the native toast list)', () => {
    render(<ToastCard tone="success" title="Saved" message="Done" onClose={() => undefined} />);
    expect(typeof widthOf()).toBe('number');
  });

  it('fits phone screens with a side margin and caps at 420 on wide ones', () => {
    const rn = jest.requireActual('react-native');
    const spy = jest.spyOn(rn, 'useWindowDimensions');
    spy.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
    render(<ToastCard tone="info" title="Hi" onClose={() => undefined} />);
    expect(widthOf()).toBe(328);
    spy.mockReturnValue({ width: 1200, height: 800, scale: 1, fontScale: 1 });
    screen.unmount();
    render(<ToastCard tone="info" title="Hi" onClose={() => undefined} />);
    expect(widthOf()).toBe(420);
    spy.mockRestore();
  });

  it('shows the title and message text', () => {
    render(<ToastCard tone="error" title="Upload failed" message="Try again" onClose={() => undefined} />);
    expect(screen.getByText('Upload failed')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
