<script lang="ts">
import { setContext, untrack } from "svelte";

interface Props {
  Component: any;
  data: any;
  [key: string]: any;
}

let { Component, data: sourceData, ...rest }: Props = $props();
const data = untrack(() => sourceData);

setContext("data", data);
</script>

<Component {...rest} />
