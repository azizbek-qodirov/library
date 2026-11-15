import React, { useState, useRef, useEffect } from 'react';

interface Option {
  id: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search and select...',
  multiple = false,
  disabled = false,
  className = '',
  label,
  required = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const highlighted = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      highlighted?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionId: string) => {
    if (multiple) {
      const newValue = selectedValues.includes(optionId)
        ? selectedValues.filter(id => id !== optionId)
        : [...selectedValues, optionId];
      onChange(newValue);
    } else {
      onChange(optionId);
      setIsOpen(false);
      setSearchQuery('');
    }
    inputRef.current?.focus();
  };

  const handleRemove = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      onChange(selectedValues.filter(id => id !== optionId));
    } else {
      onChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          handleSelect(filteredOptions[highlightedIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  const getSelectedLabel = (id: string) => {
    const option = options.find(opt => opt.id === id);
    if (option) {
      return option.label;
    }
    // If option not found and loading, show truncated UUID
    if (options.length === 0) {
      return 'Loading...';
    }
    // Show truncated UUID with ellipsis
    return id.length > 8 ? id.substring(0, 8) + '...' : id;
  };

  return (
    <div className={`${className}`}>
      {label && (
        <label className="form-label fw-semibold">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <div ref={containerRef} className="position-relative">
        <div
          className={`form-control d-flex flex-wrap align-items-center gap-1 ${disabled ? 'bg-light' : ''}`}
          style={{ minHeight: '38px', cursor: disabled ? 'not-allowed' : 'text' }}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {selectedValues.map(val => {
            const label = getSelectedLabel(val);
            return (
              <span
                key={`${val}-${options.length}`}
                className="badge bg-primary d-flex align-items-center gap-1"
                style={{ fontSize: '0.875rem' }}
                title={val}
              >
                {label}
                {!disabled && (
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: '0.5rem', padding: '0.25rem' }}
                    onClick={(e) => handleRemove(val, e)}
                    aria-label="Remove"
                  />
                )}
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            className="border-0 outline-0 flex-grow-1"
            style={{
              minWidth: '120px',
              outline: 'none',
              boxShadow: 'none',
              background: 'transparent'
            }}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => !disabled && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedValues.length === 0 ? placeholder : ''}
            disabled={disabled}
          />
        </div>

        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="position-absolute w-100 mt-1 border rounded bg-white shadow-lg"
            style={{
              maxHeight: '250px',
              overflowY: 'auto',
              zIndex: 1000
            }}
          >
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-muted">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = selectedValues.includes(option.id);
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={option.id}
                    className={`p-2 cursor-pointer ${isHighlighted ? 'bg-light' : ''
                      } ${isSelected ? 'bg-primary bg-opacity-10' : ''} ${option.disabled ? 'opacity-50' : ''
                      }`}
                    style={{
                      cursor: option.disabled ? 'not-allowed' : 'pointer',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                    onClick={() => !option.disabled && handleSelect(option.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      {multiple && (
                        <input
                          type="checkbox"
                          className="form-check-input m-0"
                          checked={isSelected}
                          onChange={() => { }}
                          disabled={option.disabled}
                        />
                      )}
                      <div className="flex-grow-1">
                        <div className="fw-medium">{option.label}</div>
                        {option.subtitle && (
                          <small className="text-muted">{option.subtitle}</small>
                        )}
                      </div>
                      {isSelected && !multiple && (
                        <span className="text-primary">✓</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      <small className="text-muted">
        {multiple && selectedValues.length > 0 && `${selectedValues.length} selected`}
      </small>
    </div>
  );
};

export default SearchableSelect;
