import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical } from 'lucide-react';

/**
 * Block-specific settings editor.
 * Renders form fields based on block.type.
 */
export default function BlockEditor({ block, onUpdate }) {
  const { t } = useTranslation();
  const type = block.type;
  const settings = block.settings || {};

  const update = (key, value) => onUpdate({ [key]: value });

  // Reusable input
  const TextInput = ({ label, field, placeholder, multiline }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={settings[field] || ''}
          onChange={e => update(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white resize-none"
        />
      ) : (
        <input
          type="text"
          value={settings[field] || ''}
          onChange={e => update(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
        />
      )}
    </div>
  );

  const SelectInput = ({ label, field, options }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={settings[field] || ''}
        onChange={e => update(field, e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const Toggle = ({ label, field }) => (
    <div className="mb-3 flex items-center justify-between">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <button
        onClick={() => update(field, !settings[field])}
        className={`w-9 h-5 rounded-full transition-colors ${settings[field] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${settings[field] ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  const NumberInput = ({ label, field, min, max }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        value={settings[field] || 0}
        onChange={e => update(field, Number(e.target.value))}
        min={min}
        max={max}
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
      />
    </div>
  );

  // List editor for items (benefits, FAQ, testimonials, etc.)
  const ListEditor = ({ field, itemFields, addLabel }) => {
    const items = settings[field] || [];
    const addItem = () => {
      const newItem = {};
      itemFields.forEach(f => { newItem[f.key] = f.default || ''; });
      update(field, [...items, newItem]);
    };
    const removeItem = (idx) => update(field, items.filter((_, i) => i !== idx));
    const updateItem = (idx, key, value) => {
      const updated = items.map((item, i) => i === idx ? { ...item, [key]: value } : item);
      update(field, updated);
    };

    return (
      <div className="mb-3">
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase">#{idx + 1}</span>
                <button onClick={() => removeItem(idx)} className="p-0.5 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {itemFields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{f.label}</label>
                  {f.multiline ? (
                    <textarea
                      value={item[f.key] || ''}
                      onChange={e => updateItem(idx, f.key, e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white resize-none"
                    />
                  ) : f.type === 'number' ? (
                    <input
                      type="number"
                      value={item[f.key] || 0}
                      onChange={e => updateItem(idx, f.key, Number(e.target.value))}
                      min={f.min}
                      max={f.max}
                      className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
                    />
                  ) : (
                    <input
                      type="text"
                      value={item[f.key] || ''}
                      onChange={e => updateItem(idx, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-1 mt-2 p-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-600 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-xs font-medium transition-colors"
        >
          <Plus className="w-3 h-3" /> {addLabel || 'Add Item'}
        </button>
      </div>
    );
  };

  // Render block-specific fields
  switch (type) {
    case 'hero':
      return (
        <>
          <TextInput label="Headline" field="headline" placeholder="Get Yours Today!" />
          <TextInput label="Subheadline" field="subheadline" placeholder="Limited time offer" />
          <TextInput label="CTA Text" field="ctaText" placeholder="Order Now" />
          <TextInput label="Background Image URL" field="backgroundImage" placeholder="https://..." />
        </>
      );

    case 'productGallery':
      return (
        <>
          <SelectInput label="Layout" field="layout" options={[
            { value: 'slider', label: 'Slider' },
            { value: 'grid', label: 'Grid' },
            { value: 'stacked', label: 'Stacked' }
          ]} />
          <Toggle label="Show Thumbnails" field="showThumbnails" />
        </>
      );

    case 'benefits':
      return (
        <ListEditor
          field="items"
          addLabel="Add Benefit"
          itemFields={[
            { key: 'title', label: 'Title', placeholder: 'Free Shipping' },
            { key: 'description', label: 'Description', placeholder: 'On all orders', multiline: true },
            { key: 'icon', label: 'Icon', placeholder: 'check, truck, shield, star' }
          ]}
        />
      );

    case 'text':
      return (
        <>
          <TextInput label="Content" field="content" placeholder="Your text here..." multiline />
          <SelectInput label="Alignment" field="alignment" options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' }
          ]} />
        </>
      );

    case 'image':
      return (
        <>
          <TextInput label="Image URL" field="url" placeholder="https://..." />
          <TextInput label="Alt Text" field="alt" placeholder="Product image" />
          <Toggle label="Full Width" field="fullWidth" />
        </>
      );

    case 'video':
      return (
        <>
          <TextInput label="Video URL (YouTube/embed)" field="url" placeholder="https://youtube.com/embed/..." />
          <Toggle label="Autoplay" field="autoplay" />
        </>
      );

    case 'testimonials':
      return (
        <ListEditor
          field="items"
          addLabel="Add Testimonial"
          itemFields={[
            { key: 'name', label: 'Name', placeholder: 'Ahmed M.' },
            { key: 'text', label: 'Testimonial', placeholder: 'Great product!', multiline: true },
            { key: 'rating', label: 'Rating (1-5)', type: 'number', min: 1, max: 5, default: 5 },
            { key: 'avatar', label: 'Avatar URL', placeholder: 'https://...' }
          ]}
        />
      );

    case 'reviews':
      return (
        <ListEditor
          field="items"
          addLabel="Add Review"
          itemFields={[
            { key: 'name', label: 'Name', placeholder: 'Sara K.' },
            { key: 'text', label: 'Review', placeholder: 'Amazing quality!', multiline: true },
            { key: 'rating', label: 'Rating', type: 'number', min: 1, max: 5, default: 5 }
          ]}
        />
      );

    case 'faq':
      return (
        <ListEditor
          field="items"
          addLabel="Add FAQ"
          itemFields={[
            { key: 'question', label: 'Question', placeholder: 'How long is delivery?' },
            { key: 'answer', label: 'Answer', placeholder: '2-5 business days', multiline: true }
          ]}
        />
      );

    case 'cta':
      return (
        <>
          <TextInput label="Button Text" field="text" placeholder="Order Now" />
          <SelectInput label="Style" field="style" options={[
            { value: 'primary', label: 'Primary' },
            { value: 'secondary', label: 'Secondary' },
            { value: 'accent', label: 'Accent' }
          ]} />
          <TextInput label="Scroll To Block" field="scrollTo" placeholder="codForm" />
        </>
      );

    case 'guarantee':
      return (
        <>
          <TextInput label="Title" field="title" placeholder="Money Back Guarantee" />
          <TextInput label="Description" field="description" placeholder="30-day return policy" multiline />
        </>
      );

    case 'countdown':
      return (
        <>
          <TextInput label="Label" field="label" placeholder="Offer ends in" />
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
            <input
              type="datetime-local"
              value={settings.endDate || ''}
              onChange={e => update('endDate', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
            />
          </div>
        </>
      );

    case 'trustBadges':
      return (
        <>
          <p className="text-xs text-gray-500 mb-2">Select trust badges to display:</p>
          {['secure', 'cod', 'fast-delivery', 'guarantee', 'original', 'warranty'].map(badge => (
            <label key={badge} className="flex items-center gap-2 mb-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={(settings.badges || []).includes(badge)}
                onChange={e => {
                  const badges = settings.badges || [];
                  update('badges', e.target.checked ? [...badges, badge] : badges.filter(b => b !== badge));
                }}
                className="rounded border-gray-300 text-blue-600"
              />
              {badge.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
          ))}
        </>
      );

    case 'deliveryInfo':
      return (
        <>
          <TextInput label="Title" field="title" placeholder="Delivery Information" />
          <TextInput label="Coverage" field="wilayas" placeholder="All 58 wilayas" />
          <TextInput label="Timeframe" field="timeframe" placeholder="2-5 days" />
        </>
      );

    case 'stockScarcity':
      return (
        <>
          <TextInput label="Message" field="message" placeholder="Only {count} left in stock!" />
          <NumberInput label="Count" field="count" min={1} max={100} />
          <Toggle label="Show Progress Bar" field="showBar" />
        </>
      );

    case 'spacer':
      return <NumberInput label="Height (px)" field="height" min={10} max={200} />;

    case 'variantSelector':
    case 'codForm':
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          This block uses the page-level settings. Configure in the Settings tab.
        </p>
      );

    default:
      return <p className="text-xs text-gray-500">No settings available for this block type.</p>;
  }
}
