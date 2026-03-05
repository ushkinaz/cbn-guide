<script lang="ts">
import { setContext, untrack } from "svelte";

interface Props {
  Component: any;
  data: any;
  [key: string]: any;
}

let { Component, data, ...rest }: Props = $props();
const dataContext = untrack(() => data);

setContext("data", dataContext);
</script>

<Component {...rest} />
