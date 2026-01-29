import React from 'react';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, ListboxLabel } from '@headlessui/react';
import { Check, ChevronDown } from './Icons';

interface Option {
    value: string;
    label: string;
    subLabel?: string;
}

interface CustomSelectProps {
    id?: string;
    label?: string;
    value: string | string[];
    onChange: (value: string | string[]) => void;
    options: Option[];
    error?: string;
    className?: string;
    placeholder?: string;
    required?: boolean;
    multiple?: boolean;
    disabled?: boolean;
}


export const CustomSelect: React.FC<CustomSelectProps> = ({
    id,
    label,
    value,
    onChange,
    options,
    error,
    className = '',
    placeholder = 'Sélectionner...',
    required = false,
    multiple = false,
    disabled = false
}) => {
    // Filter logic
    const selectedOptions = multiple
        ? options.filter(opt => (Array.isArray(value) ? value.includes(opt.value) : false))
        : options.filter(opt => opt.value === value);

    return (
        <Listbox value={value || (multiple ? [] : '')} onChange={onChange} multiple={multiple} disabled={disabled}>
            {({ open }) => {
                const displayValue = selectedOptions.length > 0
                    ? selectedOptions.map(o => o.label).join(', ')
                    : (open ? placeholder : (label ? '' : placeholder));

                return (
                    <div className={`relative ${className}`}>
                        {label && (
                            <ListboxLabel className={`
                                absolute left-4 transition-all duration-200 pointer-events-none z-10
                                -top-2.5 text-[11px] font-bold uppercase tracking-widest bg-card/90 backdrop-blur-sm px-1.5 rounded-md text-muted-foreground peer-focus:text-brand-600
                                ${error ? '!text-destructive' : ''}
                            `}>
                                {label} {required && <span className="text-destructive">*</span>}
                            </ListboxLabel>
                        )}

                        <div className="relative mt-1">
                            <ListboxButton
                                id={id}
                                className={`
                                relative w-full cursor-pointer rounded-2xl py-3.5 pl-4 pr-10 text-left
                                transition-all duration-300 outline-none min-h-[50px] backdrop-blur-sm
                                focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
                                ${error
                                        ? 'border border-destructive/60 bg-destructive/5 dark:bg-destructive/10 text-destructive'
                                        : open
                                            ? 'border border-brand-500 bg-white/80 dark:bg-white/5 shadow-lg shadow-brand-500/25 ring-2 ring-brand-300'
                                            : 'glass-input'
                                    }
                            `}>
                                <span className={`block truncate font-medium ${selectedOptions.length === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {displayValue}
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                    <ChevronDown
                                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180 text-brand-500' : ''}`}
                                        aria-hidden="true"
                                    />
                                </span>
                            </ListboxButton>

                            <ListboxOptions
                                anchor="bottom start"
                                transition
                                portal={true}
                                className="z-[99999] w-[var(--button-width)] mt-2 max-h-60 overflow-auto rounded-2xl bg-[var(--dropdown-bg)] border border-[var(--dropdown-border)] py-2 text-base shadow-lg focus:outline-none sm:text-sm custom-scrollbar transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                            >
                                {options.map((option, optionIdx) => (
                                    <ListboxOption
                                        key={optionIdx}
                                        className={({ focus }) =>
                                            `relative cursor-pointer select-none py-3 pl-10 pr-4 transition-colors ${focus ? 'bg-brand-50 dark:bg-brand-900/50 text-foreground' : 'text-muted-foreground'
                                            }`
                                        }
                                        value={option.value}
                                    >
                                        {({ selected }) => (
                                            <>
                                                <div className="flex flex-col">
                                                    <span className={`block truncate ${selected ? 'font-bold text-brand-600 dark:text-brand-400' : 'font-medium'}`}>
                                                        {option.label}
                                                    </span>
                                                    {option.subLabel && (
                                                        <span className="text-xs text-muted-foreground truncate">{option.subLabel}</span>
                                                    )}
                                                </div>
                                                {selected ? (
                                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400">
                                                        <Check className="h-4 w-4" aria-hidden="true" />
                                                    </span>
                                                ) : null}
                                            </>
                                        )}
                                    </ListboxOption>
                                ))}
                            </ListboxOptions>
                        </div>

                        {error && (
                            <p className="text-destructive text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                                {error}
                            </p>
                        )}
                    </div>
                );
            }}
        </Listbox>
    );
};
