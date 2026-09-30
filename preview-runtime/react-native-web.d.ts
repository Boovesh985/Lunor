// react-native-web ships no TypeScript types. The runtime only re-exports it
// to generated (JavaScript) apps, so an untyped module is sufficient here.
declare module 'react-native-web' {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const Pressable: any;
  export const StyleSheet: any;
  export const Platform: any;
  const ReactNativeWeb: any;
  export default ReactNativeWeb;
}
