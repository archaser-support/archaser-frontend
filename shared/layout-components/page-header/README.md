# PageHeader Component

A reusable header component that provides a consistent, modern design with slide-up animation for all pages in the application.

## Features

- **Modern Design**: Clean white background with subtle shadow and border
- **Background Pattern**: Decorative gradient overlay in the top-right corner
- **Slide-up Animation**: Smooth entrance animation on page load
- **Responsive Typography**: Adapts to different screen sizes
- **Flexible Content**: Supports title, description, and custom children content

## Usage

### Basic Usage

```tsx
import PageHeader from "@/components/PageHeader";

<PageHeader title="Page Title" description="Page description goes here" />;
```

### With Custom Content

```tsx
<PageHeader title="Page Title" description="Page description">
    <Button variant="contained" color="primary">
        Custom Action
    </Button>
</PageHeader>
```

### Without Description

```tsx
<PageHeader title="Page Title" />
```

### Custom Description Width

```tsx
<PageHeader
    title="Page Title"
    description="Long description that needs more space"
    maxWidth="800px"
/>
```

## Props

| Prop          | Type              | Default   | Description                                    |
| ------------- | ----------------- | --------- | ---------------------------------------------- |
| `title`       | `string`          | Required  | The main page title                            |
| `description` | `string`          | Optional  | The page description                           |
| `children`    | `React.ReactNode` | Optional  | Custom content to render below the description |
| `maxWidth`    | `string`          | `'500px'` | Maximum width of the description text          |

## Migration Guide

To migrate existing pages to use this component:

1. **Import the component**:

    ```tsx
    import PageHeader from "@/components/PageHeader";
    ```

2. **Replace the old header structure**:

    ```tsx
    // Old structure
    <Paper sx={{ /* complex styling */ }}>
      {/* Background pattern */}
      <Box sx={{ /* pattern styling */ }} />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={600}>
              {title}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>

    // New structure
    <PageHeader
      title={title}
      description={description}
    />
    ```

3. **Remove unused imports**:
    - Remove `Paper`, `Stack` from Material-UI imports if not used elsewhere
    - Keep `Typography` if used in other parts of the component

## Benefits

- **Consistency**: Ensures all pages have the same header design
- **Maintainability**: Changes to header design only need to be made in one place
- **Performance**: Reduces bundle size by eliminating duplicate code
- **Developer Experience**: Simple API makes it easy to add headers to new pages
