import { useState, useEffect, useRef } from "react";
import ProfileIcon from "./ProfileIcon";
import TypingIndicator from "./TypingIndicator";
import "../styles/Chatbot.css";
import send from "../assets/Send.png";
import logo from "../assets/logobot.jpg";
import { getPost, postMessage } from "../api/PostApi";
import { downloadSwagger } from "../api/PostApi"; // <-- Add this import (adjust if needed)

// Utility: Format dynamic bot message (safe HTML for <b> etc.)
const formatDynamicMessage = (text) => {
  if (!text || typeof text !== "string") return text;
  if (text.includes("<b>")) {
    const hasHeaderAndFields = text.includes("Here is the information for") &&
      text.includes("<b>Name</b>:") &&
      text.includes("<b>Email</b>:");
    if (hasHeaderAndFields) {
      const lines = text.split('\n').filter(line => line.trim());
      const formattedLines = [];
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.includes("Here is the information for")) {
          formattedLines.push(`<div class="info-header">${trimmedLine}</div>`);
        }
        else if (trimmedLine.includes("<b>") && trimmedLine.includes("</b>:")) {
          const fieldMatch = trimmedLine.match(/<b>(.*?)<\/b>:\s*(.*)/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1].trim();
            const fieldValue = fieldMatch[2].trim() || "Not provided";
            formattedLines.push(`<div class="info-field"><strong>${fieldName}:</strong> ${fieldValue}</div>`);
          }
        }
        else if (trimmedLine && !trimmedLine.match(/^\s*$/)) {
          formattedLines.push(`<div>${trimmedLine}</div>`);
        }
      });
      return `<div class="formatted-card employee-info">${formattedLines.join('')}</div>`;
    }
    const pattern = /(?:<b>(.*?)<\/b>:\s*(.*?))/gs;
    const lines = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const key = (match[1] || match[3] || "").trim();
      const value = (match[2] || match[4] || "").trim().replace(/\n/g, "<br/>");
      lines.push(`<div><strong>${key}:</strong> ${value}</div>`);
    }
    if (lines.length === 0) {
      return `<div class="formatted-card">${text.replace(/\n/g, "<br/>")}</div>`;
    }
    return `<div class="formatted-card">${lines.join("")}</div>`;
  }
  // Detect "server config" style messages by number of colons
  const isServerConfig = (text.match(/:/g) || []).length > 2;
  if (isServerConfig) {
    const lines = text.split('\n').map(line => `<div>${line.trim()}</div>`);
    return `<div class="formatted-card">${lines.join('')}</div>`;
  }
  // Always convert newlines to <br/> in default case
  return text.replace(/\n/g, "<br/>");
};

const formatFormDataToSentence = (formData, originalFields, formType = null) => {
  if (!formData || Object.keys(formData).length === 0) {
    return "No form data provided";
  }
  const sentences = [];
  const fieldLabelsMap = {};
  if (originalFields) {
    originalFields.forEach(field => {
      fieldLabelsMap[field.name] = field.label || field.name;
    });
  }
  if (formType === 'workload') {
    Object.entries(formData).forEach(([key, value]) => {
      if (key.toLowerCase().includes('service')) {
        const fieldLabel = fieldLabelsMap[key] || key;
        const formattedLabel = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);
        if (value === null || value === undefined || value === '') {
          sentences.push(``);
        } else {
          sentences.push(`${formattedLabel}: "${value}"`);
        }
      }
    });
  } else {
    Object.entries(formData).forEach(([key, value]) => {
      const fieldLabel = fieldLabelsMap[key] || key;
      const formattedLabel = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);
      if (value === null || value === undefined || value === '') {
        sentences.push(``);
      } else {
        sentences.push(`${formattedLabel}: "${value}"`);
      }
    });
  }
  return sentences.length > 0 ? sentences.join(' ') : "no values given ";
};

const hasFormFields = (response) => {
  if (!response || !response.message) return false;
  return typeof response.message === 'object' &&
    !Array.isArray(response.message) &&
    Object.keys(response.message).length > 0;
};

const determineFieldType = (fieldName, fieldValue) => {
  const lowerName = fieldName.toLowerCase();
  if (
    lowerName.includes('date') ||
    lowerName.includes('expiry') ||
    lowerName.includes('created') ||
    lowerName.includes('expire') ||
    lowerName.includes('start') ||
    lowerName.includes('end') ||
    fieldValue === 'date'
  ) {
    return 'date';
  }
  if (Array.isArray(fieldValue) && fieldValue.length > 0) {
    return 'select';
  }
  if (typeof fieldValue === 'string' && fieldValue.trim() !== '' && fieldValue !== 'date') {
    return 'text';
  }
  return 'text';
};

const determineFormType = (fields) => {
  const hasServiceField = fields.some(field => field.name.toLowerCase().includes('service'));
  const hasExpiryOrCreatedField = fields.some(field =>
    field.name.toLowerCase().includes('expiry') ||
    field.name.toLowerCase().includes('created')
  );

  // Check if this is a filter form
  const isFilterForm = fields.some(field =>
    field.name.toLowerCase().includes('filter') &&
    Array.isArray(field.options)
  );

  if (hasServiceField) return 'workload';
  if (isFilterForm) return 'filter';
  if (hasExpiryOrCreatedField) return 'multiple';
  return 'default';
};

const filterNonEmptyFields = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "date" &&
        !(typeof value === "string" && value.trim() === "") &&
        !(Array.isArray(value) && value.length === 0)
    )
  );

// FIXED: Utility function to parse service options
const parseServiceOption = (serviceValue) => {
  if (typeof serviceValue !== 'string') return { name: serviceValue, type: 'UNKNOWN' };

  // Check if service value contains -Application or -RESTAPI
  if (serviceValue.includes('-')) {
    const lastHyphenIndex = serviceValue.lastIndexOf('-');
    const name = serviceValue.substring(0, lastHyphenIndex);
    const type = serviceValue.substring(lastHyphenIndex + 1);
    return { name, type };
  }
  return { name: serviceValue, type: 'UNKNOWN' };
};

// FIXED: Clean and format swagger JSON response
const cleanSwaggerJson = (swaggerResponse) => {
  try {
    let swaggerJson;

    // If response has swaggerJson property (wrapped in an object)
    if (swaggerResponse && swaggerResponse.swaggerJson) {
      // Parse the stringified JSON
      if (typeof swaggerResponse.swaggerJson === 'string') {
        // Remove any escape characters and parse
        const cleanedString = swaggerResponse.swaggerJson.replace(/\\/g, '');
        swaggerJson = JSON.parse(cleanedString);
      } else {
        swaggerJson = swaggerResponse.swaggerJson;
      }
    }
    // If response is directly a swagger object or string
    else if (typeof swaggerResponse === 'string') {
      const cleanedString = swaggerResponse.replace(/\\/g, '');
      swaggerJson = JSON.parse(cleanedString);
    } else {
      swaggerJson = swaggerResponse;
    }



    return swaggerJson;
  } catch (error) {
    console.error('Error cleaning swagger JSON:', error);
    return swaggerResponse;
  }
};

const extractFormFields = (response, currentValues = {}) => {
  if (!hasFormFields(response)) return null;
  return Object.entries(response.message).map(([name, value]) => {
    const isService = name === 'service';
    let displayLabel = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
    displayLabel = isService ? `* ${displayLabel}` : displayLabel;
    const options = Array.isArray(value) ? value : [];
    const fieldType = options.length > 0
      ? 'select'
      : isService
        ? 'text'
        : determineFieldType(name, value);

    let initialValue;
    if (typeof currentValues[name] !== "undefined") {
      initialValue = currentValues[name];
    } else if (fieldType === "date" && value === "date") {
      initialValue = "";
    } else if (Array.isArray(value)) {
      initialValue = "";
    } else {
      initialValue = value;
    }

    return {
      name,
      label: displayLabel,
      required: isService,
      value: initialValue,
      type: fieldType,
      options,
    };
  });
};

const DynamicForm = ({
  fields,
  onSubmit,
  onCancel,
  formType,
  onFieldChange,
  isSubmittingFromParent,
  clearFormSession,
}) => {
  const [fieldDefs, setFieldDefs] = useState(fields);
  const [formData, setFormData] = useState(() =>
    Object.fromEntries(fields.map(f => [f.name, f.value || ""]))
  );
  const serviceFieldInitialValue = fields.find(f => f.name === "service")?.value || "";
  const [serviceInputValue, setServiceInputValue] = useState(
  fields.find(f => f.name === "service")?.value || ""
);
const prevServiceFieldRef = useRef(fields.find(f => f.name === "service")?.value || "");
 const serviceInputRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [serviceTypeInfo, setServiceTypeInfo] = useState({ isApplication: false, serviceOption: null });

  const allFieldsFilled = fieldDefs.every(f => !!formData[f.name]);



  useEffect(() => {
  setFieldDefs(fields);
  setFormData(current => {
    const merged = {};
    fields.forEach(f => {
      if (
        typeof current[f.name] !== "undefined" &&
        current[f.name] !== "" &&
        (typeof f.value === "undefined" || f.value === null || f.value === "")
      ) {
        merged[f.name] = current[f.name];
      } else if (typeof f.value !== "undefined" && f.value !== null) {
        merged[f.name] = f.value;
      } else {
        merged[f.name] = "";
      }
    });
    return merged;
  });

  // Only reset serviceInputValue if service field truly changed (form reset or new form)
  const newService = fields.find(f => f.name === "service")?.value || "";
  if (prevServiceFieldRef.current !== newService) {
    setServiceInputValue(newService);
    prevServiceFieldRef.current = newService;
  }
}, [fields]);


  const applyCascadingLogic = (updated, name) => {
    if (formType === "workload") {
      if (name === "service") {
        updated.layer = "";
        updated.server = "";
        updated.eg = "";
      } else if (name === "layer") {
        updated.server = "";
        updated.eg = "";
      } else if (name === "server") {
        updated.eg = "";
      }
    }
    return updated;
  };

  const handleInputChange = (name, value) => {
    let updated = { ...formData, [name]: value };
    updated = applyCascadingLogic(updated, name);
    setFormData(updated);
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };




  const handleServiceInputChange = async (value) => {
  setServiceInputValue(value);
  setFormData(prev => ({ ...prev, service: value }));
  if (errors.service) setErrors(prev => ({ ...prev, service: null }));
  if (!value.trim()) setServiceTypeInfo({ isApplication: false, serviceOption: null });

  if (value.trim().length >= 4) {
    setShowServiceDropdown(true);
    if (onFieldChange) {
      let updated = { ...formData, service: value };
      updated = applyCascadingLogic(updated, 'service');
      setFormData(updated);

      const filtered = filterNonEmptyFields(updated);
      await onFieldChange(filtered, 'service');
    }
    // Always refocus after async logic
    setTimeout(() => {
      serviceInputRef.current?.focus();
    }, 0);
  } else {
    setShowServiceDropdown(false);
  }
};


  const handleServiceOptionSelect = async (serviceValue) => {
    const { name, type } = parseServiceOption(serviceValue);

    setServiceInputValue(name);
    setShowServiceDropdown(false);

    // Store service type information when service is selected
    const isApplication = type.toUpperCase() === 'APPLICATION';
    setServiceTypeInfo({ isApplication, serviceOption: serviceValue });

    // Update form data with just the service name
    let updated = { ...formData, service: name };
    updated = applyCascadingLogic(updated, 'service');
    setFormData(updated);

    if (errors.service) setErrors(prev => ({ ...prev, service: null }));

    // Trigger API call immediately after selection
    if (onFieldChange) {
      const filtered = filterNonEmptyFields(updated);
      await onFieldChange(filtered, 'service');
    }
  };

  const handleBlur = async (name) => {
    if (name === 'service') {
      // Don't hide dropdown on blur, only when user clicks away or selects
      // Trigger API call when user clicks off the service field
      if (serviceInputValue.trim() && onFieldChange) {
        const filtered = filterNonEmptyFields(formData);
        await onFieldChange(filtered, name);
      }
    } else if (onFieldChange) {
      const filtered = filterNonEmptyFields(formData);
      await onFieldChange(filtered, name);
    }
  };

  const handleSelectChange = async (name, value) => {
    let updated = { ...formData, [name]: value };

    if (formType === 'filter' && name.toLowerCase() === 'filter') {
      updated = applyCascadingLogic(updated, name);
      setSelectedFilter(value.toLowerCase());
    } else {
      updated = applyCascadingLogic(updated, name);
    }

    setFormData(updated);
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));

    if (onFieldChange) {
      const filtered = filterNonEmptyFields(updated);
      await onFieldChange(filtered, name);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    const missing = fieldDefs.filter(f => {
      if (formType === 'filter' && selectedFilter) {
        if (selectedFilter.includes('filterexpired')) {
          return f.required && f.name.toLowerCase() === 'expires' && !formData[f.name];
        }
        if (selectedFilter.includes('filtercreated')) {
          return f.required && f.name.toLowerCase() === 'created' && !formData[f.name];
        }
      }
      return f.required && !formData[f.name];
    });

    if (missing.length > 0) {
      setErrors(prev => ({
        ...prev,
        ...Object.fromEntries(missing.map(f => [f.name, "This field is required."]))
      }));
      return;
    }

    setIsSubmitting(true);
    await onSubmit(formData, fieldDefs);
    setIsSubmitting(false);
  };

  const allRequiredFilled = fieldDefs
    .filter(f => {
      if (formType === 'filter' && selectedFilter) {
        if (selectedFilter.includes('filterexpired')) {
          return f.required && f.name.toLowerCase() === 'expires';
        }
        if (selectedFilter.includes('filtercreated')) {
          return f.required && f.name.toLowerCase() === 'created';
        }
        return false;
      }
      return f.required;
    })
    .every(f => !!formData[f.name]);

  const getFilteredServiceOptions = () => {
    const serviceField = fieldDefs.find(f => f.name === 'service');
    if (!serviceField?.options || !serviceInputValue.trim()) return serviceField?.options || [];

    return serviceField.options.filter(opt => {
      const { name } = parseServiceOption(opt);
      return name.toLowerCase().includes(serviceInputValue.toLowerCase());
    });
  };


  const renderServiceField = (field) => {
  const { name, label } = field;
  const error = errors[name];
  const isRequiredField = field.required;
  const filteredOptions = getFilteredServiceOptions();

  // Prevent losing focus when clicking dropdown
  const handleDropdownClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    serviceInputRef.current?.focus();
  };

  return (
    <div key={name} className="form-field service-field-container">
      <label className="form-label">
        {isRequiredField && <span style={{ color: "red" }}>* </span>}
        {label.replace('* ', '')}
      </label>

      <div className="service-input-container" style={{ position: 'relative' }}>
        <input
  ref={serviceInputRef}
  type="text"
  value={serviceInputValue}
  onChange={e => handleServiceInputChange(e.target.value)} // <-- use the main handler
  placeholder="Type to search (minimum 4 characters)"
  autoComplete="off"
  className={`form-input${error ? " error" : ""}`}
  disabled={isSubmitting || isSubmittingFromParent}
  style={{
    width: '100%',
    paddingRight: '12px',
    fontSize: '14px',
    height: '38px'
  }}
/>
        {/* Suggestions dropdown */}
        {showServiceDropdown && filteredOptions.length > 0 && (
          <div
            className="service-dropdown"
            onClick={handleDropdownClick}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
            {filteredOptions.map((opt, idx) => {
              const { name: serviceName, type: serviceType } = parseServiceOption(opt);
              return (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServiceOptionSelect(opt);
                    // Keep focus after selection
                    serviceInputRef.current?.focus();
                  }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: idx < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    color: '#000000'
                  }}
                  className="service-option"
                  onMouseEnter={e => { e.target.style.backgroundColor = '#f5f5f5'; }}
                  onMouseLeave={e => { e.target.style.backgroundColor = 'white'; }}>
                  <span style={{ flex: 1, fontWeight: '500', color: '#000000' }}>
                    {highlightMatch(serviceName, serviceInputValue)}
                  </span>
                  <span style={{
                    background: serviceType.toUpperCase() === 'RESTAPI' ? '#27ae60' : '#e74c3c',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginLeft: '8px'
                  }}>
                    {serviceType.replace('API', ' API')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};


// Add this utility function to highlight matching text
const highlightMatch = (text, query) => {
  if (!query || query.length < 4) return text;

  const regex = new RegExp(`(${query})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ backgroundColor: '#fff3cd', padding: 0 }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

  // Use serviceTypeInfo state instead of calculating each time
  const { isApplication } = serviceTypeInfo;

  const renderField = (field) => {
    const {
      name,
      label,
      type,
      options = [],
      placeholder,
    } = field;
    const value = formData[name] || "";
    const error = errors[name];
    const isService = name === "service";
    const isRequiredField = field.required;

    // Use special rendering for service field in workload forms
    if (isService && formType === 'workload') {
      return renderServiceField(field);
    }

    switch (type) {
      case "select":
        return (
          <div key={name} className="form-field">
            <label className="form-label">
              {isRequiredField && <span style={{ color: "red" }}>* </span>}
              {label.replace('* ', '')}
            </label>
            <select
              value={value}
              onChange={e => handleSelectChange(name, e.target.value)}
              className={`form-select${error ? " error" : ""}`}
              disabled={isSubmitting || isSubmittingFromParent || options.length === 0}
            >
              <option value="">Select {label.replace('* ', '').toLowerCase()}</option>
              {options.map((opt, idx) => (
                <option key={idx} value={opt.value || opt}>
                  {opt.label || opt}
                </option>
              ))}
            </select>
            {error && <span className="error-message">{error}</span>}
          </div>
        );

      case "textarea":
        return (
          <div key={name} className="form-field">
            <label className="form-label">
              {isRequiredField && <span style={{ color: "red" }}>* </span>}
              {label.replace('* ', '')}
            </label>
            <textarea
              value={value}
              onChange={e => handleInputChange(name, e.target.value)}
              placeholder={placeholder || ""}
              className={`form-textarea${error ? " error" : ""}`}
              rows={3}
              disabled={isSubmitting || isSubmittingFromParent}
            />
            {error && <span className="error-message">{error}</span>}
          </div>
        );
      default:
        return (
          <div key={name} className="form-field">
            <label className="form-label">
              {isRequiredField && <span style={{ color: "red" }}>* </span>}
              {label.replace('* ', '')}
            </label>
            <input
              type="text"
              value={value}
              onChange={e => handleInputChange(name, e.target.value)}
              onBlur={() => handleBlur(name)}
              placeholder={placeholder || ""}
              className={`form-input${error ? " error" : ""}`}
              disabled={isSubmitting || isSubmittingFromParent}
            />
            {error && <span className="error-message">{error}</span>}
          </div>
        );
    }
  };

  // FIXED: handleDownloadSwagger function with clean JSON formatting
  const handleDownloadSwagger = async () => {
    const { server, eg, service } = formData;

    if (serviceTypeInfo.isApplication) {
      alert("Swagger file doesn't exist for applications");
      return;
    }

    if (!server || !eg || !service) {
      alert("Please fill all required fields for download.");
      return;
    }

    try {
      const response = await downloadSwagger({ server, egName: eg, apiName: service });

      // Clean and format the swagger JSON using the new function
      const cleanedSwaggerJson = cleanSwaggerJson(response);

      // Add service-specific info to the swagger if available
      if (cleanedSwaggerJson && typeof cleanedSwaggerJson === 'object') {
        if (!cleanedSwaggerJson.info.title || cleanedSwaggerJson.info.title === 'API Documentation') {
          cleanedSwaggerJson.info.title = `${service} API Documentation` || 'API Documentation';
        }
        if (!cleanedSwaggerJson.host && server) {
          cleanedSwaggerJson.host = server;
        }
      }

      // Format as clean JSON without extra escaping
      const formattedJson = JSON.stringify(cleanedSwaggerJson, null, 2);

      // Create and download the file
      const blob = new Blob([formattedJson], {
        type: "application/json;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${service}-swagger-spec.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`✅ Successfully downloaded Swagger specification for ${service}`);

      // Clear the form session after successful download
      if (clearFormSession) {
        clearFormSession();
      }

    } catch (err) {
      alert("Failed to download Swagger file.");
      console.error("Swagger download error:", err);

      // Clear the form session after error
      if (clearFormSession) {
        clearFormSession();
      }
    }
  };

  const isApp = serviceTypeInfo.isApplication;

  return (
    <div className="dynamic-form-container">
      <form onSubmit={handleSubmit} className="dynamic-form">
        {fieldDefs.map(renderField)}
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="cancel-button" disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={
              isSubmitting ||
              isSubmittingFromParent ||
              (formType === "workload" && !allFieldsFilled) ||
              (formType === "filter" && !allRequiredFilled)
            }
          >
            {isSubmitting || isSubmittingFromParent ? "Processing..." : "Submit"}
          </button>

         {formType === "workload" && allFieldsFilled && (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <button
      type="button"
      className="download-swagger-button"
      onClick={handleDownloadSwagger}
      disabled={isSubmitting || isSubmittingFromParent || isApp}
      style={{
        marginLeft: 8,
        background: isApp ? "#ccc" : "#007BFF",
        color: "white",
        cursor: isApp ? "not-allowed" : "pointer",
        fontSize: "15px",
        borderRadius: "4px",
        padding: "10px 20px",
        opacity: isApp ? "0.6" : "1",
        border: "none",
        position: 'relative'
      }}
      title={isApp ? "Swagger file doesn't exist for applications" : "Download Swagger"}
    >
      Download Swagger
      {isApp}
    </button>
    <style>{`
      .download-swagger-button:hover > div {
        display: flex !important;
        fontSize: "50px"
      }
    `}</style>
  </div>
)}
        </div>
      </form>
    </div>
  );
};

const Chatbot = ({ setChatbotMinimized }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [formDisabled, setFormDisabled] = useState(true);
  const [activeForm, setActiveForm] = useState(null);
  const [currentFormType, setCurrentFormType] = useState(null);
  const [currentFormFields, setCurrentFormFields] = useState(null);

  const messagesEndRef = useRef(null);
  const timeoutRef = useRef(null);
  const API_TIMEOUT = 200000;

  const clearCurrentTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const clearFormSession = () => {
    setActiveForm(null);
    setCurrentFormType(null);
    setCurrentFormFields(null);
    setFormDisabled(true);
  };

  const setApiTimeout = (errorHandler) => {
    clearCurrentTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      errorHandler();
    }, API_TIMEOUT);
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  const checkEnableForm = (text) => {
    const lowerText = text.toLowerCase();
    return lowerText.includes("enter") || lowerText.includes("provide");
  };

  const getPostData = async () => {
    try {
      setIsTyping(true);
      setApiTimeout(() => {
        setMessages([{
          id: Date.now(),
          text: "Unable to load messages. Please try again later.",
          sender: "bot",
          time: getCurrentTime(),
        }]);
      });

      const res = await getPost();
      clearCurrentTimeout();

      const formattedMessages = res.data.chat_history.map((item, index) => {
        const message = {
          id: Date.now() + index,
          text: typeof item.message === 'string' ? item.message : "",
          sender: item.sender.toLowerCase() === "you" ? "user" : "bot",
          time: getCurrentTime(),
          options: item.options || [],
        };

        if (hasFormFields(item)) {
          message.formFields = extractFormFields(item, {});
          message.isFormMessage = true;
        }

        return message;
      });

      setMessages(formattedMessages);
      setFormDisabled(true);
      setIsTyping(false);
    } catch {
      clearCurrentTimeout();
      setIsTyping(false);
      setMessages([{
        id: Date.now(),
        text: "An error occurred while loading messages.",
        sender: "bot",
        time: getCurrentTime(),
      }]);
    }
  };

  useEffect(() => {
    getPostData();
    return () => clearCurrentTimeout();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeForm]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    const userMsg = {
      id: Date.now(),
      text: newMessage,
      sender: "user",
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setNewMessage("");
    setIsTyping(true);
    setFormDisabled(true);

    try {
      setApiTimeout(() => { });
      const res = await postMessage(newMessage);
      clearCurrentTimeout();

      const latest = res.data.chat_history?.slice(-1)[0];
      if (latest) {
        const botResponse = {
          id: Date.now(),
          text: latest.message || "",
          sender: "bot",
          time: getCurrentTime(),
          options: latest.options || [],
        };

        if (hasFormFields(latest)) {
          botResponse.formFields = extractFormFields(latest, {});
          botResponse.isFormMessage = true;
        }

        setMessages((prev) => [...prev, botResponse]);
        setFormDisabled(!checkEnableForm(botResponse.text));
      }
    } catch {
      clearCurrentTimeout();
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: "An error occurred. Please try again.",
          sender: "bot",
          time: getCurrentTime(),
        },
      ]);
    }

    setIsTyping(false);
  };

  const handleOptionClick = async (optionText) => {
    const cleanedOpt = optionText.replace(/^\d+\.|[a-zA-Z]\.\s*/, "").trim();

    const userMessage = {
      id: Date.now(),
      text: cleanedOpt,
      sender: "user",
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setFormDisabled(true);
    setIsTyping(true);

    try {
      setApiTimeout(() => { });
      const res = await postMessage(cleanedOpt);
      clearCurrentTimeout();

      const latest = res.data.chat_history?.slice(-1)[0];
      if (latest) {
        const botResponse = {
          id: Date.now(),
          text: latest.message || "",
          sender: "bot",
          time: getCurrentTime(),
          options: latest.options || [],
        };

        if (hasFormFields(latest)) {
          botResponse.formFields = extractFormFields(latest, {});
          botResponse.isFormMessage = true;
        }

        setMessages((prev) => [...prev, botResponse]);
        setFormDisabled(!checkEnableForm(botResponse.text));
      }
    } catch {
      clearCurrentTimeout();
    }

    setIsTyping(false);
  };

  const handleFieldChange = async (fieldData, changedFieldName) => {
    try {
      setIsTyping(true);
      setApiTimeout(() => {});

      const filteredData = filterNonEmptyFields(fieldData);
      if (Object.keys(filteredData).length === 0) {
        setIsTyping(false);
        return;
      }
      const payload = { message: filteredData };
      const res = await postMessage(payload);
      clearCurrentTimeout();

      const latest = res.data.chat_history?.slice(-1)[0];
      if (latest && hasFormFields(latest)) {
        const updatedFields = extractFormFields(latest, fieldData);
        setActiveForm(updatedFields);
        setCurrentFormFields(updatedFields);
      }
    } catch (error) {
      clearCurrentTimeout();
    } finally {
      setIsTyping(false);
    }
  };

  const handleFormSubmit = async (formData, originalFields) => {
    setActiveForm(null);
    setCurrentFormType(null);

    const completeFormData = filterNonEmptyFields(formData);

    const formattedText = formatFormDataToSentence(formData, originalFields, currentFormType);

    const userMessage = {
      id: Date.now(),
      text: formattedText,
      sender: "user",
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setFormDisabled(true);

    try {
      setApiTimeout(() => { });
      const payload = { message: completeFormData };
      const res = await postMessage(payload);
      clearCurrentTimeout();

      const latest = res.data.chat_history?.slice(-1)[0];
      if (latest) {
        const botResponse = {
          id: Date.now(),
          text: typeof latest.message === 'string' ? latest.message : "",
          sender: "bot",
          time: getCurrentTime(),
          options: latest.options || [],
        };

        if (hasFormFields(latest)) {
          botResponse.formFields = extractFormFields(latest, completeFormData);
          botResponse.isFormMessage = true;
        }

        setMessages((prev) => [...prev, botResponse]);
        setFormDisabled(!checkEnableForm(botResponse.text));
      }
    } catch (error) {
      clearCurrentTimeout();
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: "An error occurred while submitting the form. Please try again.",
          sender: "bot",
          time: getCurrentTime(),
        },
      ]);
    }
    setIsTyping(false);
  };

  const handleFormCancel = () => {
    setActiveForm(null);
    setCurrentFormType(null);
    setCurrentFormFields(null);
  };

  const handleFormButtonClick = (fields) => {
    const formType = determineFormType(fields);
    setCurrentFormType(formType);
    setCurrentFormFields(fields);
    setActiveForm(fields);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setChatbotMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
    setChatbotMinimized(false);
  };

  return (
    <div className={`chat-container ${isMinimized ? "minimized" : ""}`}>
      <div className="chat-header">
        <img src={logo} alt="Logo" className="chat-logo" onClick={handleRestore} />
        {!isMinimized && (
          <>
            <div className="chat-title">
              <h1>EIS GINI</h1>
              <h5>(Generative Interactive Neural Interface)</h5>
            </div>
            <button className="minimize-button" onClick={handleMinimize}>
              &#x2212;
            </button>
          </>
        )}
      </div>
      {!isMinimized && (
        <>
          <div className="messages-container">
            {messages.map((item, index) => (
              <div
                key={index}
                className={`message-wrapper ${item.sender.toLowerCase()}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: item.sender === "user" ? "flex-end" : "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-end", gap: "5px" }}>
                  {item.sender === "bot" && <ProfileIcon sender={item.sender} />}
                  <div className={`message ${item.sender === "user" ? "user-message" : "bot-message"}`}>
                    {item.sender === "bot" && !item.isFormMessage ? (
                      <div
                        className="message-content"
                        dangerouslySetInnerHTML={{ __html: formatDynamicMessage(item.text) }}
                      />
                    ) : item.sender === "bot" && item.isFormMessage ? (
                      <div className="message-content">
                        <p>Please fill out the form with the required information:</p>
                      </div>
                    ) : (
                      <div className="message-content">{item.text}</div>
                    )}

                    {item.formFields && (
                      <div className="form-trigger">
                        <button
                          className="form-button"
                          onClick={() => handleFormButtonClick(item.formFields)}
                        >
                          Fill Form
                        </button>
                      </div>
                    )}

                    {item.options?.length > 0 && (
                      <div className="options-list">
                        {item.options.map((opt, i) => {
                          const displayText = opt.replace(/^\d+\.\s*|^[a-zA-Z]\.\s*/, "").trim().toLowerCase();
                          const isPlainText =
                            displayText.includes("please select one by name") ||
                            displayText.includes("please select from following options") ||
                            displayText === "DO YOU WANT MORE DETAILS?:" ||
                            displayText === "do you want more details?" ||
                            displayText === "do you want more details" ||
                            displayText === "do you want more details?:";

                          if (isPlainText) {
                            return (
                              <div key={i} className="plain-text-option">
                                {displayText}
                              </div>
                            );
                          }

                          return (
                            <button key={i} className="option-button" onClick={() => handleOptionClick(opt)}>
                              {displayText}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="message-time">{item.time}</div>
                  </div>
                  {item.sender === "user" && <ProfileIcon sender={item.sender} />}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "5px" }}>
                <ProfileIcon sender="bot" />
                <div className="message bot-message">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {activeForm && (
            <DynamicForm
              fields={activeForm}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              formType={currentFormType}
              onFieldChange={handleFieldChange}
              isSubmittingFromParent={isTyping}
              clearFormSession={clearFormSession}
            />
          )}
          <form className="message-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={formDisabled ? "Select a relevant option or wait for prompt..." : "Type a message..."}
              className="message-input"
              disabled={formDisabled}
            />
            <button type="submit" className="send-button" disabled={formDisabled}>
              <img className="logo" src={send} alt="Send" style={{ height: "20px", opacity: formDisabled ? 0.5 : 1 }} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default Chatbot;
