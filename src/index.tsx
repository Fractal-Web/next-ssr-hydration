// Based on previous the work of:
// - Valentin Colmant (https://github.com/valcol/react-hydration-on-demand)
// - Thanh Le (https://github.com/thanhlmm/next-lazy-hydrate)

// https://github.com/valcol/react-hydration-on-demand/blob/master/src/index.js

import React, {
  ComponentType,
  ReactElement,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';

const isClientSide = typeof window !== 'undefined';

declare const navigator: any;

type AnyFunction = (...args: unknown[]) => unknown;
type IEvent = 'delay' | 'visible' | 'idle' | keyof HTMLElementEventMap;
type IEventOption = IEvent | [IEvent, any];
type IWrapperProps = Record<string, any> | JSX.IntrinsicElements['section'];

interface IHydrateOption {
  id: string;
  on?: IEventOption[];
  onBefore?: () => Promise<any>;
  whenInputPending?: boolean;
  isInputPendingFallbackValue?: boolean;
  disableFallback?: boolean;
  wrapperProps?: IWrapperProps;
}

const eventListenerOptions = {
  once: true,
  capture: true,
  passive: true,
};

function getDisplayName(WrappedComponent: React.ComponentType<any>) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

function withHydrationOnDemandServerSide({ id, wrapperProps }: IHydrateOption) {
  return function <T>(Component: ComponentType<T>) {
    const WrappedComponent = (props: T) => (
      <section id={id} data-hydration-on-demand={true} {...wrapperProps}>
        <Component {...(props as any)} />
      </section>
    );

    WrappedComponent.displayName = getDisplayName(Component);

    return WrappedComponent;
  };
}

function withHydrationOnDemandClientSide({
  id,
  isInputPendingFallbackValue = true,
  on = [],
  onBefore,
  whenInputPending = false,
  wrapperProps,
}: IHydrateOption) {
  return function <T>(WrappedComponent: ComponentType<T>) {
    const html = (isClientSide && document.getElementById(id)?.innerHTML) || '';

    const WithHydrationOnDemand = ({
      forceHydration = false,
      ...props
    }: T & { forceHydration?: boolean }) => {
      const rootRef = useRef<HTMLElement>(null);
      const cleanupFunctions = useRef<AnyFunction[]>([]);

      const isInputPending = () => {
        // eslint-disable-next-line
        const isInputPending = navigator?.scheduling?.isInputPending?.();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return isInputPending ?? isInputPendingFallbackValue;
      };

      const getDefaultHydrationState = () => {
        const isNotInputPending = whenInputPending && !isInputPending();
        return (isNotInputPending || forceHydration) && !onBefore;
      };

      const [isHydrated, setIsHydrated] = useState(getDefaultHydrationState());

      const cleanUp = () => {
        cleanupFunctions.current.forEach(fn => fn());
        cleanupFunctions.current = [];
      };

      const hydrate = async () => {
        cleanUp();
        if (isHydrated) return;
        setIsHydrated(true);
      };

      const initDOMEvent = (
        type: keyof HTMLElementEventMap,
        getTarget = () => rootRef.current
      ) => {
        const target = getTarget();
        target?.addEventListener(type, hydrate, eventListenerOptions);
        cleanupFunctions.current.push(() => {
          if (!target) return;
          target.removeEventListener(type, hydrate, eventListenerOptions);
        });
      };

      const initTimeout = (delay = 2000) => {
        if (delay <= 0) return;

        const timeout = setTimeout(hydrate, delay);
        cleanupFunctions.current.push(() => clearTimeout(timeout));
      };

      const initIdleCallback = () => {
        if (!('requestIdleCallback' in window)) {
          initTimeout();
          return;
        }

        const idleCallback = requestIdleCallback(
          () => requestAnimationFrame(() => hydrate()),
          {
            timeout: 500,
          }
        );

        if (!('cancelIdleCallback' in window)) return;

        cleanupFunctions.current.push(() => {
          cancelIdleCallback(idleCallback);
        });
      };

      const initIntersectionObserver = (getOptions = Function.prototype) => {
        if (!('IntersectionObserver' in window)) {
          void hydrate();
          return;
        }

        if (!rootRef.current) {
          void hydrate();
          return;
        }

        const options = getOptions();
        const observer = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting || !(entry.intersectionRatio > 0)) return;

          void hydrate();
        }, options);

        cleanupFunctions.current.push(() => {
          if (!observer) return;
          observer.disconnect();
        });

        observer.observe(rootRef.current);
      };

      const initEvent = (type: IEvent, options?: any) => {
        switch (type) {
          case 'delay':
            initTimeout(options);
            break;
          case 'visible':
            initIntersectionObserver(options);
            break;
          case 'idle':
            initIdleCallback();
            break;
          default:
            initDOMEvent(type, options);
        }
      };

      useEffect(() => {
        if (isHydrated) return;

        on.forEach(event =>
          Array.isArray(event) ? initEvent(...event) : initEvent(event)
        );
        return cleanUp;
      }, []);

      if (!isHydrated)
        return (
          <section
            ref={rootRef}
            dangerouslySetInnerHTML={{ __html: html }}
            suppressHydrationWarning
            {...wrapperProps}
          />
        );

      return (
        <Suspense
          fallback={
            <section
              ref={rootRef}
              dangerouslySetInnerHTML={{ __html: html }}
              suppressHydrationWarning
              {...wrapperProps}
            />
          }
        >
          <WrappedComponent {...(props as any)} />
        </Suspense>
      );
    };

    WithHydrationOnDemand.displayName = `withHydrationOnDemand(${getDisplayName(
      WrappedComponent
    )})`;

    return WithHydrationOnDemand;
  };
}

export function withHydrationOnDemand(options: IHydrateOption) {
  if (isClientSide) return withHydrationOnDemandClientSide(options);

  return withHydrationOnDemandServerSide(options);
}

export function passThroughLoading(): ReactElement {
  throw Promise.resolve();
}
