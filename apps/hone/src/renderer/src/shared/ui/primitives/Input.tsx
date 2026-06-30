/**
 * Hone Input + Textarea — foundation primitive (visual-language v2).
 *
 * Form fields are underline-only per v2 spec. Bordered variant kept as
 * a legacy fallback (e.g. wrapped select). NEW building block — does NOT
 * migrate any existing inputs.
 *
 * Contract:
 *  - `underline` variant (default):
 *      border-bottom: 1px solid var(--hair-2); padding-bottom: 8px;
 *      background: transparent; outline: none;
 *      focus: border-bottom-color var(--ink); border-bottom-width 1.5px
 *      (compensated via padding-bottom 7px → no layout shift).
 *  - `bordered`: full 1px border around, radius 6.
 *  - Error state: red 1.5px bottom + red helperText +
 *      1.5×24px red signal stripe rendered before the label.
 *  - Sizes: sm (13px / 6px py), md (14px / 8px py, default), lg (16px / 12px py).
 *  - A11y: auto useId, <label htmlFor>, aria-describedby for helperText,
 *      aria-invalid + aria-errormessage when errorMessage present.
 *  - Tokens: var(--hair-2), var(--ink), var(--ink-60), var(--red),
 *      var(--motion-dur-small), var(--motion-ease-standard).
 */

import {
  forwardRef,
  useId,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

export type InputVariant = 'underline' | 'bordered';
export type InputSize = 'sm' | 'md' | 'lg';

interface SizeSpec {
  fontSize: number;
  py: number;
}

const SIZE_SPEC: Record<InputSize, SizeSpec> = {
  sm: { fontSize: 13, py: 6 },
  md: { fontSize: 14, py: 8 },
  lg: { fontSize: 16, py: 12 },
};

const COLOR_INK = 'var(--ink)';
const COLOR_INK_DIM = 'var(--ink-60)';
const COLOR_HAIRLINE = 'var(--hair-2)';
const COLOR_RED = 'var(--red)';

const LABEL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: COLOR_INK_DIM,
  marginBottom: 6,
  lineHeight: 1.2,
};

const HELPER_STYLE: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  lineHeight: 1.3,
  color: COLOR_INK_DIM,
};

const SIGNAL_STRIPE_STYLE: CSSProperties = {
  display: 'inline-block',
  width: 1.5,
  height: 24,
  background: COLOR_RED,
  marginRight: 8,
  flexShrink: 0,
  alignSelf: 'center',
};

function buildFieldStyle(
  variant: InputVariant,
  size: InputSize,
  hasError: boolean,
  focused: boolean,
): CSSProperties {
  const spec = SIZE_SPEC[size];
  const focusBorderColor = hasError ? COLOR_RED : COLOR_INK;
  const restingBorderColor = hasError ? COLOR_RED : COLOR_HAIRLINE;
  const focusWidth = hasError || focused ? 1.5 : 1;
  const padBottom = variant === 'underline' ? spec.py - (focusWidth - 1) : spec.py;
  const base: CSSProperties = {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    appearance: 'none',
    background: 'transparent',
    color: COLOR_INK,
    fontSize: spec.fontSize,
    lineHeight: 1.4,
    outline: 'none',
    fontFamily: 'inherit',
    transition:
      'border-color var(--motion-dur-small) var(--motion-ease-standard), border-bottom-width var(--motion-dur-small) var(--motion-ease-standard)',
  };
  if (variant === 'underline') {
    return {
      ...base,
      border: 'none',
      borderBottom: `${focusWidth}px solid ${focused ? focusBorderColor : restingBorderColor}`,
      borderRadius: 0,
      padding: `${spec.py}px 0 ${padBottom}px 0`,
    };
  }
  return {
    ...base,
    border: `${focusWidth}px solid ${focused ? focusBorderColor : restingBorderColor}`,
    borderRadius: 6,
    padding: `${spec.py}px 10px`,
  };
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  variant?: InputVariant;
  size?: InputSize;
  rightIcon?: ReactNode;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id: idProp,
    label,
    helperText,
    errorMessage,
    variant = 'underline',
    size = 'md',
    rightIcon,
    leftIcon,
    onFocus,
    onBlur,
    style,
    disabled,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const id = idProp ?? `input-${reactId}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorMessage);
  const describedBy = hasError ? errorId : helperText ? helperId : undefined;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
      {hasError && <span aria-hidden style={SIGNAL_STRIPE_STYLE} />}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        {label && (
          <label htmlFor={id} style={LABEL_STYLE}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          {leftIcon && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: variant === 'bordered' ? 10 : 0,
                color: COLOR_INK_DIM,
                pointerEvents: 'none',
                display: 'inline-flex',
              }}
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-errormessage={hasError ? errorId : undefined}
            aria-describedby={describedBy}
            onFocus={(e) => {
              const focusStyle = buildFieldStyle(variant, size, hasError, true);
              Object.assign(e.currentTarget.style, focusStyle);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              const blurStyle = buildFieldStyle(variant, size, hasError, false);
              Object.assign(e.currentTarget.style, blurStyle);
              onBlur?.(e);
            }}
            style={{
              ...buildFieldStyle(variant, size, hasError, false),
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
              paddingLeft: leftIcon ? (variant === 'bordered' ? 32 : 22) : undefined,
              paddingRight: rightIcon ? (variant === 'bordered' ? 32 : 22) : undefined,
              ...style,
            }}
            {...rest}
          />
          {rightIcon && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: variant === 'bordered' ? 10 : 0,
                color: COLOR_INK_DIM,
                pointerEvents: 'none',
                display: 'inline-flex',
              }}
            >
              {rightIcon}
            </span>
          )}
        </div>
        {hasError ? (
          <div id={errorId} role="alert" style={{ ...HELPER_STYLE, color: COLOR_RED }}>
            {errorMessage}
          </div>
        ) : helperText ? (
          <div id={helperId} style={HELPER_STYLE}>
            {helperText}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  variant?: InputVariant;
  size?: InputSize;
  rightIcon?: ReactNode;
  leftIcon?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id: idProp,
    label,
    helperText,
    errorMessage,
    variant = 'underline',
    size = 'md',
    rightIcon,
    leftIcon,
    onFocus,
    onBlur,
    style,
    disabled,
    rows = 3,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const id = idProp ?? `textarea-${reactId}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorMessage);
  const describedBy = hasError ? errorId : helperText ? helperId : undefined;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
      {hasError && <span aria-hidden style={SIGNAL_STRIPE_STYLE} />}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        {label && (
          <label htmlFor={id} style={LABEL_STYLE}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
          {leftIcon && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: variant === 'bordered' ? 10 : 0,
                top: SIZE_SPEC[size].py,
                color: COLOR_INK_DIM,
                pointerEvents: 'none',
                display: 'inline-flex',
              }}
            >
              {leftIcon}
            </span>
          )}
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-errormessage={hasError ? errorId : undefined}
            aria-describedby={describedBy}
            onFocus={(e) => {
              const focusStyle = buildFieldStyle(variant, size, hasError, true);
              Object.assign(e.currentTarget.style, focusStyle);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              const blurStyle = buildFieldStyle(variant, size, hasError, false);
              Object.assign(e.currentTarget.style, blurStyle);
              onBlur?.(e);
            }}
            style={{
              ...buildFieldStyle(variant, size, hasError, false),
              resize: 'vertical',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
              paddingLeft: leftIcon ? (variant === 'bordered' ? 32 : 22) : undefined,
              paddingRight: rightIcon ? (variant === 'bordered' ? 32 : 22) : undefined,
              ...style,
            }}
            {...rest}
          />
          {rightIcon && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: variant === 'bordered' ? 10 : 0,
                top: SIZE_SPEC[size].py,
                color: COLOR_INK_DIM,
                pointerEvents: 'none',
                display: 'inline-flex',
              }}
            >
              {rightIcon}
            </span>
          )}
        </div>
        {hasError ? (
          <div id={errorId} role="alert" style={{ ...HELPER_STYLE, color: COLOR_RED }}>
            {errorMessage}
          </div>
        ) : helperText ? (
          <div id={helperId} style={HELPER_STYLE}>
            {helperText}
          </div>
        ) : null}
      </div>
    </div>
  );
});
