import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
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
    // Filter logic remains the same
    const selectedOptions = multiple
        ? options.filter(opt => (Array.isArray(value) ? value.includes(opt.value) : false))
        : options.filter(opt => opt.value === value);

    return (
        <Listbox value={value} onChange={onChange} multiple={multiple} disabled={disabled}>
            {({ open }) => {
                const displayValue = selectedOptions.length > 0
                    ? selectedOptions.map(o => o.label).join(', ')
                    : (open ? placeholder : (label ? '' : placeholder));

                return (
                    <div className={`relative ${className} ${open ? 'z-[60]' : 'z-auto'}`}>
                        {label && (
                            <Listbox.Label className={`
                                absolute left-4 transition-all duration-200 pointer-events-none z-10
                                ${(open || selectedOptions.length > 0)
                                    ? '-top-2.5 text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-900 px-1 rounded text-brand-600'
                                    : 'top-3.5 text-sm font-medium text-slate-600'
                                }
                                ${error ? '!text-red-500' : ''}
                            `}>
                                {label} {required && <span className="text-red-500">*</span>}
                            </Listbox.Label>
                        )}

                        <div className="relative mt-1">
                            <Listbox.Button className={`
                                relative w-full cursor-pointer rounded-2xl py-3.5 pl-4 pr-10 text-left 
                                border transition-all duration-300 outline-none min-h-[50px]
                                ${error
                                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10 text-red-900 dark:text-red-100'
                                    : open
                                        ? 'border-brand-500/50 ring-4 ring-brand-500/10 bg-white/80 dark:bg-slate-900/80 shadow-lg shadow-brand-500/5 backdrop-blur-xl'
                                        : 'border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-brand-500/30 hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-md'
                                }
                            `}>
                                <span className={`block truncate font-medium ${selectedOptions.length === 0 ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                    {displayValue}
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                    <ChevronDown
                                        className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                                        aria-hidden="true"
                                    />
                                </span>
                            </Listbox.Button>

                            <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                            >
                                <Listbox.Options className="absolute z-[100] mt-2 max-h-60 w-full overflow-auto rounded-2xl bg-white/90 dark:bg-slate-900/90 py-2 text-base shadow-xl shadow-slate-900/10 ring-1 ring-black/5 focus:outline-none sm:text-sm custom-scrollbar border border-white/20 dark:border-white/10 backdrop-blur-xl">
                                    {options.map((option, optionIdx) => (
                                        <Listbox.Option
                                            key={optionIdx}
                                            className={({ active }) =>
                                                `relative cursor-pointer select-none py-3 pl-10 pr-4 transition-colors ${active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-slate-900 dark:text-slate-100'
                                                }`
                                            }
                                            value={option.value}
                                        >
                                            {({ selected }) => (
                                                <>
                                                    <span className={`block truncate ${selected ? 'font-bold text-brand-600 dark:text-brand-400' : 'font-medium'}`}>
                                                        {option.label}
                                                    </span>
                                                    {selected ? (
                                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400">
                                                            <Check className="h-4 w-4" aria-hidden="true" />
                                                        </span>
                                                    ) : null}
                                                </>
                                            )}
                                        </Listbox.Option>
                                    ))}
                                </Listbox.Options>
                            </Transition>
                        </div>
                        {error && (
                            <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                                {error}
                            </p>
                        )}
                    </div>
                );
            }}
        </Listbox>
    );
};
